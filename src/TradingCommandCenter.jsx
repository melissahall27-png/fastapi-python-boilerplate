import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore } from "react";

/* ============================================================
   TRADING COMMAND CENTER
   Journal · Watchlist · News · Quotes · Strat Playbook + Coach
   Built for a Strat trader (IWM-first, AI/semi watchlist).
   Persists to localStorage. AI features call Anthropic via /api/claude.
   ============================================================ */

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

.tcc {
  --bg:#0F141A; --bg2:#171E27; --bg3:#1E2630;
  --line:#33404E; --line2:#42505F;
  --bone:#F6F4EF; --dim:#B8C1CD; --faint:#95A0AD;
  --brass:#F2BE6E; --brass-dim:#C79A52;
  --bull:#5BCE9C; --bear:#F48374; --focus:#7FB3E4; --comp:#A9D2EC;
  font-family:'Inter',sans-serif; color:var(--bone);
  background:var(--bg); min-height:100%; letter-spacing:-0.01em;
}
.tcc *{box-sizing:border-box;}
.tcc .mono{font-family:'JetBrains Mono',monospace;}
.tcc .disp{font-family:'Archivo',sans-serif;}
.tcc .eyebrow{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.18em;font-size:11.5px;color:var(--dim);}
.tcc button{font-family:inherit;cursor:pointer;}
.tcc input,.tcc select,.tcc textarea{
  font-family:inherit;background:var(--bg);border:1px solid var(--line2);
  color:var(--bone);border-radius:8px;padding:11px 13px;font-size:15px;width:100%;outline:none;
}
.tcc input:focus,.tcc select:focus,.tcc textarea:focus{border-color:var(--brass);}
.tcc input.mono{font-family:'JetBrains Mono',monospace;}
.tcc ::placeholder{color:var(--faint);}
.tcc select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--dim) 50%),linear-gradient(135deg,var(--dim) 50%,transparent 50%);background-position:calc(100% - 16px) 52%,calc(100% - 11px) 52%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:30px;}

@keyframes tape { from{transform:translateX(0);} to{transform:translateX(-50%);} }
.tape-track{display:inline-flex;white-space:nowrap;animation:tape 60s linear infinite;}
.tcc:hover .tape-track{animation-play-state:paused;}
@media (prefers-reduced-motion: reduce){ .tape-track{animation:none;} }

.tcc .card{background:var(--bg2);border:1px solid var(--line);border-radius:14px;}
.tcc .btn{background:var(--bg3);border:1px solid var(--line2);color:var(--bone);border-radius:9px;padding:11px 16px;font-size:14.5px;font-weight:600;transition:border-color .15s,background .15s;}
.tcc .btn:hover{border-color:var(--brass);}
.tcc .btn-primary{background:var(--brass);border:1px solid var(--brass);color:#241A0A;font-weight:700;}
.tcc .btn-primary:hover{background:#eab973;}
.tcc .btn-ghost{background:transparent;border:1px solid transparent;color:var(--dim);}
.tcc .btn-ghost:hover{color:var(--bone);border-color:var(--line2);}
.tcc .tag{font-family:'JetBrains Mono',monospace;font-size:11.5px;padding:3px 7px;border-radius:5px;border:1px solid var(--line2);color:var(--dim);text-transform:uppercase;letter-spacing:0.08em;}
.tcc .spin{width:14px;height:14px;border:2px solid var(--line2);border-top-color:var(--brass);border-radius:50%;animation:sp .7s linear infinite;display:inline-block;}
@keyframes sp{to{transform:rotate(360deg);}}
.tcc .scroll::-webkit-scrollbar{width:8px;height:8px;}
.tcc .scroll::-webkit-scrollbar-thumb{background:var(--line2);border-radius:8px;}
.tcc a{color:var(--focus);text-decoration:none;}
.tcc a:hover{text-decoration:underline;}
.tcc .gloss-row{display:grid;grid-template-columns:160px 1fr;gap:18px;padding:12px 0;border-bottom:1px solid var(--line);align-items:baseline;}
.tcc .gloss-row:last-child{border-bottom:none;}
.tcc .gloss-term{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:14.5px;color:var(--brass);}
.tcc .gloss-def{font-size:14.5px;line-height:1.6;color:var(--comp);}
.tcc .gloss-def b{color:#B9DAF0;font-weight:600;}
@media(max-width:560px){.tcc .gloss-row{grid-template-columns:1fr;gap:4px;padding:10px 0;}}
`;

const MODEL = "claude-sonnet-4-6";
/* Serverless proxy. The API key lives on the server, never in this bundle. */
const API_ENDPOINT = "/api/claude";
const DEFAULT_WATCH = ["IWM","SPY","QQQ","XLK","XLV","XLF","XLY","XLP","XLE","XLI","XLB","XLU","XLRE","XLC","UNH","MDT","GILD","V","UBER","RIVN","NVDA","AMD","AVGO","SMCI","MU","ARM","MRVL","TSM","QCOM"];
const REQUIRED_ADD = ["IWM","UNH","XLK","XLV","XLF","MDT","GILD","V","XLY","XLP","XLE","XLI","XLB","XLU","XLRE","XLC","UBER","RIVN"]; // one-time merge for existing users
// exchange prefixes for Webull + TradingView deep links
const EXCH = {
  IWM:"nysearca", SPY:"nysearca", QQQ:"nasdaq", DIA:"nysearca",
  XLK:"nysearca", XLV:"nysearca", XLF:"nysearca", XLE:"nysearca", XLY:"nysearca", XLI:"nysearca", XLP:"nysearca", XLU:"nysearca", XLB:"nysearca", XLRE:"nysearca", XLC:"nysearca", SMH:"nasdaq",
  UNH:"nyse", TSM:"nyse", MDT:"nyse", V:"nyse", GILD:"nasdaq", UBER:"nyse", RIVN:"nasdaq",
  NVDA:"nasdaq", AMD:"nasdaq", AVGO:"nasdaq", SMCI:"nasdaq", MU:"nasdaq", ARM:"nasdaq", MRVL:"nasdaq", QCOM:"nasdaq", INTC:"nasdaq", AAPL:"nasdaq", MSFT:"nasdaq", GOOGL:"nasdaq", AMZN:"nasdaq", META:"nasdaq", TSLA:"nasdaq",
};
const TV_MAP = { nysearca:"AMEX", nasdaq:"NASDAQ", nyse:"NYSE" };
function linksFor(sym, interval="15"){
  const s = (sym||"").toUpperCase();
  const ex = EXCH[s];
  const wbPrefix = ex || "nasdaq";
  const tvSym = ex ? `${TV_MAP[ex]}:${s}` : s;
  const tvE = encodeURIComponent(tvSym);
  return {
    tvSym,
    tv:      `https://www.tradingview.com/chart/?symbol=${tvE}&interval=${interval}`,
    rh:      `https://robinhood.com/stocks/${s}`,
    rhOpt:   `https://robinhood.com/options/chains/${s}`,
    wb:      `https://www.webull.com/quote/${wbPrefix}-${s.toLowerCase()}`,
    exchName: ex ? TV_MAP[ex] : "—",
  };
}
const SETUPS = ["2-2 continuation","2-1-2 reversal","2-1-2 continuation","3-1-2","1-2-2 reversal","2-2 reversal","3-2-2","Rev Strat","FTFC break","Failed 2","Other"];
const TFS = ["1m","5m","15m","60m","Daily","Weekly","Monthly"];
const EMOTIONS = ["On plan","Disciplined","FOMO","Revenge","Hesitated","Overtraded"];
const HORIZONS = ["Scalp","Day","Swing","Position"];

/* ---------- storage helpers (localStorage w/ in-memory fallback) ----------
   Everything is namespaced under TCC_PREFIX so export/import can round-trip the
   whole app without touching anything else on the domain. Kept async so every
   existing await sGet(...) / await sSet(...) call site works unchanged. */
export const TCC_PREFIX = "tcc:";
const mem = {};
async function sGet(key){
  try{
    const raw = window.localStorage.getItem(TCC_PREFIX + key);
    return raw == null ? null : JSON.parse(raw);
  }catch(e){ return key in mem ? mem[key] : null; }
}
async function sSet(key,val){
  try{ window.localStorage.setItem(TCC_PREFIX + key, JSON.stringify(val)); }
  catch(e){ mem[key] = val; }   // private mode / quota full -> session-only
}

/* ---------- auto-run scans ----------
   Prices are free (Yahoo) and refresh on their own, but each SCAN is a paid AI
   call, so scans never auto-run unless the user turns ⏱ Auto ON. When it's on, a
   scanner re-runs itself once when you open its tab — but only if the last scan
   is stale (older than AUTO_STALE_MS). A fresh scan is left alone, so opening a
   tab you just scanned won't spend a cent. "Scan / refresh now" buttons are
   always there regardless of the toggle. Default: OFF. */
const AUTO_STALE_MS = 30*60*1000;   // re-run a scan only if the last one is older than 30 min
const autoSubs = [];
function autoScansOn(){ try{ return window.localStorage.getItem(TCC_PREFIX+"auto:scans")==="true"; }catch(e){ return mem["auto:scans"]===true; } }
function setAutoScans(v){ try{ window.localStorage.setItem(TCC_PREFIX+"auto:scans", v?"true":"false"); }catch(e){ mem["auto:scans"]=!!v; } autoSubs.forEach(f=>{ try{ f(); }catch(e){} }); }
function autoSub(f){ autoSubs.push(f); return ()=>{ const i=autoSubs.indexOf(f); if(i>=0) autoSubs.splice(i,1); }; }
/* Fire runFn once when a scanner mounts (its tab was opened) — and again the
   moment Auto is flipped on — IF Auto is on and the last scan is stale. `ready`
   guards against firing before the stored last-scan time has loaded; a ref makes
   sure it never loops or double-spends within a single mount. */
function useAutoScan(ready, lastTs, busy, runFn){
  const ran = useRef(false);
  const fn = useRef(runFn); fn.current = runFn;
  useEffect(()=>{
    function maybe(){
      if(ran.current || !ready || busy || !autoScansOn()) return;
      const stale = !lastTs || (Date.now()-lastTs) > AUTO_STALE_MS;
      if(!stale) return;
      ran.current = true;
      try{ fn.current(); }catch(e){}
    }
    maybe();
    return autoSub(maybe);
  },[ready,lastTs,busy]);
}

/* ---------- api helpers ---------- */
/* One global gate for every AI call in the app: requests are serialized with a
   minimum gap, retried with real backoff, and a rate-limit trips a visible
   cooldown instead of a dead-end error. */
const AI = { calls:0, gap:4000, gapMin:4000, gapMax:20000, last:0, chain:Promise.resolve(), coolUntil:0, trips:0, subs:[] };
const RL_MSG = "Message rate limit — too many AI requests too fast. Wait for the cooldown, then tap again.";
function aiSub(f){ AI.subs.push(f); return ()=>{ AI.subs = AI.subs.filter(x=>x!==f); }; }
function aiPing(){ AI.subs.forEach(f=>{ try{ f(); }catch(e){} }); }
function aiCoolLeft(){ return Math.max(0, Math.ceil((AI.coolUntil - Date.now())/1000)); }
function aiClearCool(){ AI.coolUntil = 0; aiPing(); }
function isRateLimit(m){ return /rate.?limit|too many requests|\b429\b/i.test(String(m||"")); }
/* Every AI failure in the app reports through here, so the real reason shows
   instead of a generic "check connection". */
function aiErr(e, what){
  const m=(e&&e.message)||"";
  const left=aiCoolLeft();
  if(left>0) return left>90 ? `⏳ Rate limit — this chat's AI budget is spent. Wait ${Math.ceil(left/60)} min, or use the hosted build.` : `⏳ Rate limit — wait ${left}s, then tap again.`;
  if(m===RL_MSG || isRateLimit(m)) return "⏳ Rate limit — the app sent AI requests faster than allowed. Wait about a minute, then tap again.";
  if(/api key/i.test(m)) return m;
  if(/failed to fetch|networkerror|network error/i.test(m)) return `${what} failed — no connection. Check your network and retry.`;
  return `${what} failed — ${m||"unknown error"}`;
}
function aiQueue(fn){
  const run = AI.chain.then(async()=>{
    const wait = AI.last + AI.gap - Date.now();
    if(wait>0) await new Promise(r=>setTimeout(r, wait));
    try{ return await fn(); } finally { AI.last = Date.now(); }
  });
  AI.chain = run.catch(()=>{});
  return run;
}
async function callClaude({system, messages, tools, maxTokens=1000}){
  const left = aiCoolLeft();
  if(left>0) throw new Error(`Cooling down — ${left}s left, then tap again.`);
  const body = { model: MODEL, max_tokens: maxTokens, messages };
  if(system) body.system = system;
  if(tools) body.tools = tools;
  return aiQueue(async()=>{
    /* A trip may have happened while this request sat in the queue. Re-check at
       the moment of firing so backed-up calls fail fast instead of each burning
       four more attempts against an API that is already refusing us. */
    const still = aiCoolLeft();
    if(still>0) throw new Error(RL_MSG);
    const backoff=[2500,7000,15000];
    let lastErr="";
    for(let a=0; a<4; a++){
      try{
        const res = await fetch(API_ENDPOINT,{
          method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
        });
        if(res.ok){ AI.calls++; AI.trips=0; AI.gap=Math.max(AI.gapMin, AI.gap*0.85); aiPing(); return res.json(); }
        let t=""; try{ t=await res.text(); }catch(e){}
        lastErr="API "+res.status+(t?": "+t.slice(0,140):"");
        if(res.status===429 || res.status>=500 || isRateLimit(t)){
          // Anthropic tells us exactly how long to wait — honor it (capped) for
          // both the retry spacing and the visible cooldown, instead of guessing.
          const ra=parseInt(res.headers.get("retry-after")||"",10);
          const raMs=(isFinite(ra)&&ra>0)?Math.min(ra,300)*1000:0;
          if(a<3){ await new Promise(r=>setTimeout(r, raMs||backoff[a])); continue; }
          AI.gap=Math.min(AI.gapMax, AI.gap*1.75);
          AI.trips=(AI.trips||0)+1; AI.coolUntil = Date.now()+(raMs||(AI.trips>=3?300000:AI.trips===2?120000:45000)); aiPing();
          throw new Error(RL_MSG);
        }
        throw new Error(lastErr);
      }catch(e){
        lastErr=(e&&e.message)||"network error";
        if(lastErr===RL_MSG) throw e;
        if(isRateLimit(lastErr)){
          if(a<3){ await new Promise(r=>setTimeout(r, backoff[a])); continue; }
          AI.gap=Math.min(AI.gapMax, AI.gap*1.75);
          AI.trips=(AI.trips||0)+1; AI.coolUntil = Date.now()+(AI.trips>=3?300000:AI.trips===2?120000:45000); aiPing();
          throw new Error(RL_MSG);
        }
        if(a<3){ await new Promise(r=>setTimeout(r, backoff[a])); continue; }
        throw new Error(lastErr);
      }
    }
    throw new Error(lastErr||"request failed");
  });
}

/* Small header readout: how many AI calls this session + live cooldown timer. */
function AiMeter(){
  const [,bump]=useState(0);
  useEffect(()=>{
    const un=aiSub(()=>bump(n=>n+1));
    const iv=setInterval(()=>{ if(aiCoolLeft()>0) bump(n=>n+1); },1000);
    return ()=>{ un(); clearInterval(iv); };
  },[]);
  const left=aiCoolLeft();
  if(!AI.calls && !left) return null;
  return (
    <div className="mono" style={{fontSize:11.5,marginTop:4,color:left?"var(--bear)":"var(--faint)"}}>
      {left ? <span>⏳ cooling down {left}s <button onClick={aiClearCool} className="mono" style={{marginLeft:6,border:"1px solid var(--line2)",background:"var(--bg3)",color:"var(--brass)",borderRadius:6,padding:"2px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>try now</button></span>
            : `${AI.calls} AI call${AI.calls===1?"":"s"} this session`}
    </div>
  );
}

/* ---------- live cooldown plumbing ----------
   aiErr() bakes the seconds into a string at the moment of failure, so that text
   freezes and goes stale. useCoolLeft subscribes to a 1s tick and returns the
   real remaining seconds, so anything rendering it stays honest. */
function useCoolLeft(){
  const [left,setLeft]=useState(aiCoolLeft());
  useEffect(()=>{
    const sync=()=>setLeft(aiCoolLeft());
    const un=aiSub(sync);
    const iv=setInterval(sync,1000);
    return ()=>{ un(); clearInterval(iv); };
  },[]);
  return left;
}
/* Renders an AI error. If a cooldown is actually running it overrides the stored
   text with a live count; when it expires it says so instead of leaving a dead
   number on screen. */
function AiErrLine({msg}){
  const left=useCoolLeft();
  if(!msg) return null;
  const wasCool=/rate limit|cooling down/i.test(String(msg));
  if(wasCool){
    if(left>0) return (
      <div className="mono" style={{color:"var(--bear)",fontSize:13.5,marginTop:8}}>
        ⏳ Rate limit — {left>90?`about ${Math.ceil(left/60)} min left`:`${left}s left`}.
      </div>
    );
    return (
      <div className="mono" style={{color:"var(--brass)",fontSize:13.5,marginTop:8}}>
        ✓ Cooldown over — tap again.
      </div>
    );
  }
  return <div style={{color:"var(--bear)",fontSize:13.5,marginTop:8}}>{msg}</div>;
}
function getText(data){
  if(!data || !data.content) return "";
  return data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
}
function extractObjs(text){
  if(!text) return [];
  const t=String(text); const out=[];
  for(let i=0;i<t.length;i++){
    if(t[i]!=="{") continue;
    let dc=0,inStr=false,esc=false;
    for(let j=i;j<t.length;j++){ const ch=t[j];
      if(inStr){ if(esc)esc=false; else if(ch==="\\")esc=true; else if(ch==='"')inStr=false; }
      else if(ch==='"')inStr=true;
      else if(ch==="{")dc++;
      else if(ch==="}"){ dc--; if(dc===0){ try{ out.push(JSON.parse(t.slice(i,j+1))); }catch(e){} i=j; break; } }
    }
  }
  return out;
}
function extractJson(text){
  if(!text) return null;
  let t = text.replace(/```json/gi,"").replace(/```/g,"").trim();
  const fa=t.indexOf("["), fo=t.indexOf("{");
  let start = fa===-1?fo : fo===-1?fa : Math.min(fa,fo);
  if(start===-1) return null;
  let s = t.slice(start);
  const end = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if(end!==-1){ try{ return JSON.parse(s.slice(0,end+1)); }catch(e){} }
  // repair a truncated response: close open string + unbalanced brackets, drop a trailing partial field
  try{
    let dc=0,db=0,inStr=false,esc=false;
    for(let i=0;i<s.length;i++){ const ch=s[i];
      if(inStr){ if(esc)esc=false; else if(ch==="\\")esc=true; else if(ch==='"')inStr=false; }
      else if(ch==='"')inStr=true;
      else if(ch==="{")dc++; else if(ch==="}")dc--;
      else if(ch==="[")db++; else if(ch==="]")db--;
    }
    let fix=s;
    if(inStr) fix+='"';
    fix=fix.replace(/[,\s]*$/,"");
    fix=fix.replace(/,?\s*"[^"]*"\s*:\s*$/,"");
    fix=fix.replace(/[,\s]*$/,"");
    while(db-->0) fix+="]";
    while(dc-->0) fix+="}";
    return JSON.parse(fix);
  }catch(e){ return null; }
}

/* ---------- pnl + date helpers ---------- */
function num(v){
  if(v==null) return null;
  let s=String(v).replace(/[$\s]/g,"");
  if(s.indexOf(",")>-1 && s.indexOf(".")>-1){ s=s.replace(/,/g,""); }        // 1,000.50 → 1000.50
  else if((s.match(/\./g)||[]).length>1){ s=s.replace(/\./g,""); }           // 1.000.000 → 1000000
  else if((s.match(/,/g)||[]).length>1){ s=s.replace(/,/g,""); }             // 1,000,000 → 1000000
  else { s=s.replace(/,/g,""); }                                             // 1,000 → 1000 (single comma = thousands)
  const n=parseFloat(s); return isNaN(n)?null:n;
}
function computePnl(t){
  if(t.pnlManual!=null && t.pnlManual!=="") { const m=num(t.pnlManual); if(m!=null) return m; }
  const e=num(t.entry), x=num(t.exit), q=num(t.quantity);
  if(e==null||x==null||q==null) return null;
  const dir = t.direction==="Short" ? -1 : 1;
  const mult = t.instrument==="Option" ? 100 : (t.instrument==="Future" ? (num(t.multiplier)||1) : 1);
  return (x-e)*q*mult*dir;
}
function fmtMoney(n){
  if(n==null) return "—";
  const s = n<0?"-":"";
  return s+"$"+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:2,minimumFractionDigits:0});
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function startOfWeek(){
  const d=new Date(); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d;
}

/* ============================================================ */
const RH_SEEDS=[
  {id:"rh-01",date:"2026-05-26",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"290",expiry:"2026-05-26",entry:"0.80",exit:"0.66",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-14.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 5/26 · 1x 0.80\u21920.66"},
  {id:"rh-02",date:"2026-05-26",ticker:"MRVL",instrument:"Stock",direction:"Long",optType:"Call",strike:"",expiry:"",entry:"182.20",exit:"204.36",quantity:"0.548847",multiplier:"",setup:"Other",timeframe:"",horizon:"Swing",pnlManual:"12.16",planFollowed:true,emotion:"On plan",notes:"Robinhood import · market sell · 0.5488 sh 182.20\u2192204.36"},
  {id:"rh-03",date:"2026-05-26",ticker:"QQQ",instrument:"Stock",direction:"Long",optType:"Call",strike:"",expiry:"",entry:"712.15",exit:"730.17",quantity:"0.14042",multiplier:"",setup:"Other",timeframe:"",horizon:"Swing",pnlManual:"2.53",planFollowed:true,emotion:"On plan",notes:"Robinhood import · market sell · 0.1404 sh 712.15\u2192730.17"},
  {id:"rh-04",date:"2026-05-26",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"291",expiry:"2026-05-26",entry:"0.41",exit:"0.02",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-39.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 5/26 · 1x 0.41\u21920.02 (near total loss)"},
  {id:"rh-05",date:"2026-05-26",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"290",expiry:"2026-05-26",entry:"0.80",exit:"0.34",quantity:"2",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-92.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 5/26 · 2x 0.80\u21920.34"},
  {id:"rh-06",date:"2026-05-27",ticker:"NKE",instrument:"Option",direction:"Long",optType:"Call",strike:"46.5",expiry:"2026-05-29",entry:"0.56",exit:"0.52",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-4.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 5/27 · 1x 0.56\u21920.52"},
  {id:"rh-07",date:"2026-05-27",ticker:"AMZN",instrument:"Option",direction:"Long",optType:"Call",strike:"272.5",expiry:"2026-05-27",entry:"0.49",exit:"0.16",quantity:"2",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-66.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 5/27 · 2x 0.49\u21920.16"},
  {id:"rh-08",date:"2026-05-28",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"292",expiry:"2026-05-28",entry:"0.56",exit:"0.58",quantity:"2",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"4.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 5/28 · 2x 0.56\u21920.58 (winner)"},
  {id:"rh-09",date:"2026-06-05",ticker:"NVDA",instrument:"Option",direction:"Long",optType:"Call",strike:"207.5",expiry:"2026-06-05",entry:"0.35",exit:"0.34",quantity:"4",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-4.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 6/5 · 4x 0.35\u21920.34"},
  {id:"rh-10",date:"2026-06-09",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"288",expiry:"2026-06-09",entry:"0.77",exit:"1.43",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"66.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 6/9 · 1x 0.77\u21921.43 (winner +86%)"},
  {id:"rh-11",date:"2026-06-09",ticker:"QID",instrument:"Option",direction:"Long",optType:"Call",strike:"16",expiry:"2026-06-18",entry:"0.36",exit:"0.33",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Swing",pnlManual:"-3.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 6/9 · 1x 0.36\u21920.33 (QID = 2x inverse Nasdaq)"},
  {id:"rh-12",date:"2026-06-12",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"294",expiry:"2026-06-12",entry:"1.05",exit:"0.89",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-16.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 6/12 · 1x 1.05\u21920.89"},
  {id:"rh-13",date:"2026-06-18",ticker:"CRWV",instrument:"Option",direction:"Long",optType:"Call",strike:"160",expiry:"2026-06-18",entry:"2.53",exit:"0.00",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Swing",pnlManual:"-253.00",planFollowed:false,emotion:"On plan",notes:"Robinhood import · EXPIRED WORTHLESS 6/18 · 1x 2.53\u21920 (-100%). Held to expiration with no stop \u2014 biggest single loss."},
  {id:"rh-14",date:"2026-06-24",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"300",expiry:"2026-06-24",entry:"0.24",exit:"0.36",quantity:"4",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"48.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 6/24 · 4x 0.24\u21920.36 (winner +50%)"},
  {id:"rh-15",date:"2026-06-26",ticker:"UNH",instrument:"Option",direction:"Long",optType:"Call",strike:"427.5",expiry:"2026-06-26",entry:"1.08",exit:"1.42",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"34.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 6/26 · 1x 1.08\u21921.42 (winner)"},
  {id:"rh-16",date:"2026-06-30",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"300",expiry:"2026-06-30",entry:"0.57",exit:"0.71",quantity:"2",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"28.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 6/30 · 2x 0.57\u21920.71 (winner)"},
  {id:"rh-17",date:"2026-07-01",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"302",expiry:"2026-07-01",entry:"0.47",exit:"0.58",quantity:"2",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"22.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/1 · 2x 0.47\u21920.58 (winner)"},
  {id:"rh-18",date:"2026-07-02",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"300",expiry:"2026-07-02",entry:"0.81",exit:"0.50",quantity:"2",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-62.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/2 · 2x 0.81\u21920.50"},
  {id:"rh-19",date:"2026-07-06",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"298",expiry:"2026-07-07",entry:"1.79",exit:"1.58",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-21.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/6 · 1x 1.79\u21921.58"},
  {id:"rh-20",date:"2026-07-07",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"297",expiry:"2026-07-07",entry:"0.79",exit:"0.72",quantity:"2",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-14.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/7 · 2x 0.79\u21920.72"},
];

const RH_SEEDS2=[
  {id:"rh-21",date:"2026-07-14",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"294",expiry:"2026-07-14",entry:"1.41",exit:"0.96",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-45.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/14 · 1x 1.41\u21920.96"},
  {id:"rh-22",date:"2026-07-14",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"295",expiry:"2026-07-14",entry:"0.40",exit:"0.60",quantity:"2",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"40.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/14 · 2x 0.40\u21920.60 (winner +50%)"},
  {id:"rh-23",date:"2026-07-14",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Put",strike:"292",expiry:"2026-07-14",entry:"0.25",exit:"0.00",quantity:"4",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-100.00",planFollowed:false,emotion:"On plan",notes:"Robinhood import · EXPIRED WORTHLESS 7/14 · 4x 0.25\u21920 (-100%). Put held to expiration, no stop."},
  {id:"rh-24",date:"2026-07-15",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"299",expiry:"2026-07-15",entry:"0.04",exit:"0.02",quantity:"20",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-40.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/15 · 20x 0.04\u21920.02 (far-OTM lotto, 20 contracts)"},
  {id:"rh-25",date:"2026-07-15",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"297",expiry:"2026-07-15",entry:"0.35",exit:"0.16",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-19.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/15 · 1x 0.35\u21920.16"},
  {id:"rh-26",date:"2026-07-17",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"295",expiry:"2026-07-17",entry:"0.87",exit:"0.89",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"2.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/17 · 1x 0.87\u21920.89 (scratch winner)"},
  {id:"rh-27",date:"2026-07-22",ticker:"GLD",instrument:"Option",direction:"Long",optType:"Call",strike:"381",expiry:"2026-07-22",entry:"0.64",exit:"0.95",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"31.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/22 · 1x 0.64\u21920.95 (winner +48%, GLD = gold)"},
  {id:"rh-28",date:"2026-07-22",ticker:"NVDA",instrument:"Option",direction:"Long",optType:"Call",strike:"215",expiry:"2026-07-22",entry:"0.70",exit:"0.10",quantity:"1",multiplier:"",setup:"Other",timeframe:"",horizon:"Day",pnlManual:"-60.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · closed 7/22 · 1x 0.70\u21920.10 (-86%)"},
];

const RH_SEEDS3=[
  {id:"rh-31",date:"2026-07-31",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"292",expiry:"2026-07-31",entry:"",exit:"",quantity:"",multiplier:"",setup:"2-2 continuation",timeframe:"60m",horizon:"Day",pnlManual:"20.00",planFollowed:true,emotion:"On plan",notes:"Robinhood import · 7/31 · the 294 continuation call. Bought for $52, scaled out in 3 ($16+$35+$21=$72) = +$20. Read the move and banked into strength."},
];

export default function TradingCommandCenter(){
  const [tab,setTab]=useState("today");
  const [trades,setTrades]=useState([]);
  const [watch,setWatch]=useState(DEFAULT_WATCH);
  const [quotes,setQuotes]=useState({});
  const [loaded,setLoaded]=useState(false);
  const [showHelp,setShowHelp]=useState(true);
  useEffect(()=>{ (async()=>{ try{ const s=await sGet("ui:showHelp"); if(s===false) setShowHelp(false); }catch(e){} })(); },[]);
  useEffect(()=>{ sSet("ui:showHelp",showHelp); },[showHelp]);
  const [autoScans,setAutoScansState]=useState(false);
  useEffect(()=>{ setAutoScansState(autoScansOn()); },[]);
  const toggleAuto=()=>{ const v=!autoScansOn(); setAutoScans(v); setAutoScansState(v); };
  const firstSave=useRef(true);

  // load
  useEffect(()=>{ (async()=>{
    let t=await sGet("journal:trades"); if(!Array.isArray(t)) t=[];
    const jseed=await sGet("journal:seedWk728");
    if(!jseed){
      const seeds=[
        {id:"seed-jul28-put",date:"2026-07-28",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Put",strike:"290",expiry:"2026-07-28",entry:"0.06",exit:"0.03",quantity:"10",multiplier:"",setup:"Other",timeframe:"5m",horizon:"Scalp",pnlManual:"-29.88",planFollowed:false,emotion:"FOMO",notes:"0DTE. Right direction, wrong instrument — called it down and IWM fell to 289.12, but $4 OTM, $0.06 premium (below floor), wide spread, no time left. The clock decided it; a Jul 31 expiry would've roughly doubled."},
        {id:"seed-jul30-call",date:"2026-07-30",ticker:"IWM",instrument:"Option",direction:"Long",optType:"Call",strike:"292",expiry:"2026-07-30",entry:"0.18",exit:"0.45",quantity:"1",multiplier:"",setup:"Other",timeframe:"5m",horizon:"Scalp",pnlManual:"27.00",planFollowed:false,emotion:"FOMO",notes:"0DTE. Won on the same shaky structure that lost Jul 28 — outcome and process came apart. $0.18 premium below floor, OTM until the final run to 292.28. A 29-cent slip before the bell zeroes it."},
      ];
      seeds.forEach(s=>{ if(!t.some(x=>x.id===s.id)) t.push(s); });
      await sSet("journal:seedWk728",true);
    }
    const rhseed=await sGet("journal:seedRH");
    if(!rhseed){
      RH_SEEDS.forEach(s=>{ if(!t.some(x=>x.id===s.id)) t.push(s); });
      await sSet("journal:seedRH",true);
    }
    const rhseed2=await sGet("journal:seedRH2");
    if(!rhseed2){
      RH_SEEDS2.forEach(s=>{ if(!t.some(x=>x.id===s.id)) t.push(s); });
      await sSet("journal:seedRH2",true);
    }
    const fix1=await sGet("journal:fixJul30");
    if(!fix1){
      t=t.map(x=> x.id==="seed-jul30-call" ? {...x, setup:"2-2 continuation", timeframe:"60m", planFollowed:true, emotion:"On plan", notes:"Called 294 ahead of time. 1-hour FTFC staircase, 2-up continuation — took profit into strength at 0.45 (+150%). The model trade: read the move, banked the pivot."} : x);
      await sSet("journal:fixJul30",true);
    }
    const rhseed3=await sGet("journal:seedRH3");
    if(!rhseed3){
      RH_SEEDS3.forEach(s=>{ if(!t.some(x=>x.id===s.id)) t.push(s); });
      await sSet("journal:seedRH3",true);
    }
    const fix2=await sGet("journal:fixRh31");
    if(!fix2){
      t=t.map(x=> x.id==="rh-31" ? {...x, notes:"7/31 · the 294 continuation call, net +$20. Scaled out $16+$35+$21 against $52 cost. The final 2 contracts were AUTO-CLOSED by Robinhood at 3:45 PM at $0.08 (−$10 on that slice) — the 0DTE risk-check closeout, not my exit. Lesson: banked most of it, but let the tail get taken by the bot. Sell the last piece yourself before 3:30."} : x);
      await sSet("journal:fixRh31",true);
    }
    const coachSeeded=await sGet("coach:seeded");
    if(!coachSeeded){ const ex=await sGet("coach:kb"); const base=Array.isArray(ex)?ex:[]; const merged=[...COACH_KB_SEED.filter(s=>!base.some(b=>b.id===s.id)),...base]; await sSet("coach:kb",merged); await sSet("coach:seeded",true); }
    const stopRule=await sGet("coach:stopRule");
    if(!stopRule){
      let kb=await sGet("coach:kb"); if(!Array.isArray(kb)) kb=[];
      const rule={id:"kb-stoprule",title:"Hard stop rule (non-negotiable)",content:"Every long option gets a pre-defined stop WRITTEN at entry — max 40–50% loss on the position, then close, no argument. The two trades that cost ~$353 combined (CRWV −$253 and the IWM $292 put −$100) had one thing in common: no pre-defined exit. Zero is never the stop on a long option. Also never size UP just because a contract is cheap (the 20× $0.04 lotto). Enforce this on every trade I run past you — if I have no stop, tell me not to take it."};
      if(!kb.some(k=>k.id===rule.id)) kb=[rule,...kb];
      await sSet("coach:kb",kb); await sSet("coach:stopRule",true);
    }
    const tfFix=await sGet("coach:tfFix");
    if(!tfFix){
      let kb=await sGet("coach:kb"); if(Array.isArray(kb)){
        kb=kb.map(k=> k.id==="kb-style" ? {...k,content:"Trades IWM primarily (plus AI/semis and select names) using The Strat + options. Reads top-down: Daily/60m for bias, and 5m/15m/30m for triggers (I watch 5m, 15m, 30m, 1H, daily, weekly, monthly). Mostly buys directional calls/puts; day-trades and some swings."} : k);
        await sSet("coach:kb",kb);
      }
      await sSet("coach:tfFix",true);
    }
    const tsLessons=await sGet("coach:tsLessons");
    if(!tsLessons){
      let kb=await sGet("coach:kb"); if(!Array.isArray(kb)) kb=[];
      const add=[
        {id:"kb-rr",title:"Risk/reward gate (1:3)",content:"Plan every trade with a defined risk and target BEFORE entry, aiming for 1:3 reward-to-risk or better; under 1:2, skip it. With a 1:3 RR I can be wrong more often than right and still grow the account — so judge trades by quality and RR, not by being right. Only take A+ setups."},
        {id:"kb-reasons",title:"Multiple reasons to enter",content:"Only enter when there are MULTIPLE real reasons (a confirmation checklist), not one. 'It's cheap' or 'it's moving' is not a reason. Wait for confirmation; never jump in early. If I'm forcing it, that's the frustration/greed trap — skip."},
        {id:"kb-delta2",title:"Delta over strike (day trades)",content:"For day trades I'm trading the option's movement, not holding to expiration — so delta (P&L per $1 move) matters more than hitting the strike. Pick the delta that gives the best risk vs reward. My defaults stay: near-money, delta 0.55–0.70, liquid."},
        {id:"kb-paper",title:"Prove it before real money",content:"Before risking real money on a new strategy, paper-trade and backtest it (real prices, fake money) to prove both that the strategy works AND that I'm disciplined enough to follow it. If I can't follow the rules with fake money, I won't with real."},
        {id:"kb-review",title:"Weekly journal review",content:"Every weekend, 30–60 min: review the week's trades — did I follow my plan? Entries/exits aligned with rules? Risk managed? Which setups paid, which bled? When the same mistake shows up 3 weeks running, make an action plan to fix it. Use the EOD + Weekly Scorecard buttons."},
        {id:"kb-mindset",title:"Skill-building mindset",content:"Come in to build skill, not get rich quick. Get-rich-quick makes me size up early and hold losers on hope. Measure myself by how well I followed my process, not today's P&L. One trade won't make or break me — breaking my rules will. Stay calm, patient, disciplined."},
      ];
      add.forEach(a=>{ if(!kb.some(k=>k.id===a.id)) kb=[a,...kb]; });
      await sSet("coach:kb",kb); await sSet("coach:tsLessons",true);
    }
    const threeQ=await sGet("coach:threeQ");
    if(!threeQ){
      let kb=await sGet("coach:kb"); if(!Array.isArray(kb)) kb=[];
      const q={id:"kb-3q",title:"Strategy answers 3 questions before entry",content:"Before any entry my strategy must answer: (1) exactly WHERE & WHY I enter (setup + trigger), (2) exactly WHERE I exit if WRONG (stop, set before entry), (3) exactly WHERE I take profit if RIGHT (target, 1:3+ RR, scale out). If I can't answer all three, I don't have a trade. Foundation first: read the chart, use a repeatable process, paper-trade to prove it, journal everything."};
      if(!kb.some(k=>k.id===q.id)) kb=[q,...kb];
      await sSet("coach:kb",kb); await sSet("coach:threeQ",true);
    }
    setTrades(t);
    const w=await sGet("watchlist:tickers");
    let list = (Array.isArray(w)&&w.length) ? [...w] : [...DEFAULT_WATCH];
    const ver = await sGet("settings:watchVersion");
    if(ver!==6){ REQUIRED_ADD.forEach(t=>{ if(!list.includes(t)) list.push(t); }); await sSet("settings:watchVersion",6); }
    setWatch(list);
    const q=await sGet("quotes:last"); if(q&&typeof q==="object") setQuotes(q);
    setLoaded(true);
  })(); },[]);
  // persist
  useEffect(()=>{ if(loaded) sSet("journal:trades",trades); },[trades,loaded]);
  useEffect(()=>{ if(loaded) sSet("watchlist:tickers",watch); },[watch,loaded]);
  useEffect(()=>{ if(loaded && Object.keys(quotes).length) sSet("quotes:last",quotes); },[quotes,loaded]);

  const TABS=[["guide","Guide"],["today","Today"],["dash","Dashboard"],["journal","Journal"],["review","Review"],["watch","Watchlist"],["strat","Strat"],["runner","Runner"],["scans","Scans"],["sectors","Sectors"],["tools","Tools"],["pl","P/L"],["news","News"],["play","Playbook"],["library","Library"],["tutor","Tutor"]];

  return (
    <HelpCtx.Provider value={showHelp}>
    <div className="tcc" style={{minHeight:"100vh"}}>
      <style>{STYLE}</style>
      <TickerTape watch={watch} quotes={quotes} />
      <NewsTape watch={watch} />

      {/* Header */}
      <div style={{maxWidth:1180,margin:"0 auto",padding:"22px 20px 0"}}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <h1 className="disp" style={{fontSize:30,fontWeight:800,letterSpacing:"-0.02em",lineHeight:1,margin:0}}>
              The Edge <span style={{color:"var(--brass)"}}>Room</span>
            </h1>
            <div className="mono" style={{fontSize:12,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--brass-dim)",marginTop:6}}>Built for execution &amp; results</div>
          </div>
          <div className="mono" style={{fontSize:13.5,color:"var(--dim)",textAlign:"right"}}>
            {new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}
            <div style={{color:"var(--faint)",fontSize:12.5}}>NO SIGNAL = NO TRADE</div>
            <div style={{color:"var(--brass-dim)",fontSize:12,marginTop:2}}>{tradingDaysLeft("monthly")} trading days left this month</div>
            <AiMeter/>
            <div style={{marginTop:6,display:"flex",gap:6,justifyContent:"flex-end",flexWrap:"wrap"}}>
              <button onClick={()=>setShowHelp(v=>!v)} className="mono" style={{border:"1px solid var(--line2)",background:showHelp?"transparent":"var(--bg3)",color:showHelp?"var(--dim)":"var(--brass)",borderRadius:7,padding:"4px 10px",fontSize:11.5,fontWeight:700,cursor:"pointer"}}>{showHelp?"? tips ON":"? tips OFF"}</button>
              <button onClick={toggleAuto} title="When ON, the Runner and Watchlist scans re-run themselves when you open the tab — but only if the last scan is over 30 min old. Each scan is a paid AI call; prices stay free either way." className="mono" style={{border:"1px solid "+(autoScans?"var(--brass)":"var(--line2)"),background:autoScans?"var(--bg3)":"transparent",color:autoScans?"var(--brass)":"var(--dim)",borderRadius:7,padding:"4px 10px",fontSize:11.5,fontWeight:700,cursor:"pointer"}}>{autoScans?"⏱ Auto ON":"⏱ Auto OFF"}</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,marginTop:20,borderBottom:"1px solid var(--line)",flexWrap:"wrap"}}>
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              className="disp"
              style={{background:"none",border:"none",padding:"10px 14px",fontSize:15.5,fontWeight:600,
                color: tab===id?"var(--brass)":"var(--dim)",
                borderBottom: tab===id?"2px solid var(--brass)":"2px solid transparent",marginBottom:-1}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{maxWidth:1180,margin:"0 auto",padding:"22px 20px 80px"}}>
        {tab==="guide" && <Guide/>}
        {tab==="today" && <Today trades={trades} setTrades={setTrades} watch={watch} quotes={quotes} setQuotes={setQuotes} goJournal={()=>setTab("journal")} goRunner={()=>setTab("runner")} />}
        {tab==="dash" && <Dashboard trades={trades} goJournal={()=>setTab("journal")} />}
        {tab==="journal" && <Journal trades={trades} setTrades={setTrades} watch={watch} />}
        {tab==="review" && <ReviewPanel trades={trades} />}
        {tab==="watch" && <Watchlist watch={watch} setWatch={setWatch} quotes={quotes} setQuotes={setQuotes} />}
        {tab==="strat" && <StratScanner watch={watch} />}
        {tab==="runner" && <RunnerScan watch={watch} />}
        {tab==="scans" && <ScanJournal trades={trades} />}
        {tab==="sectors" && <Sectors quotes={quotes} setQuotes={setQuotes} />}
        {tab==="tools" && <Tools watch={watch} setWatch={setWatch} />}
        {tab==="pl" && <PayoffLab watch={watch} />}
        {tab==="news" && <News watch={watch} />}
        {tab==="play" && <Playbook />}
        {tab==="library" && <KnowledgeLibrary />}
        {tab==="tutor" && <Tutor trades={trades} />}
      </div>
    </div>
    </HelpCtx.Provider>
  );
}

/* ============================ TICKER TAPE ============================ */
function TickerTape({watch,quotes}){
  const items = watch.length?watch:DEFAULT_WATCH;
  const cell = (s,i)=>{
    const q=quotes[s]; const pct=q?.changePct;
    const col = pct==null?"var(--dim)": pct>=0?"var(--bull)":"var(--bear)";
    return (
      <span key={s+i} className="mono" style={{display:"inline-flex",alignItems:"baseline",gap:8,padding:"0 20px",fontSize:14,borderRight:"1px solid var(--line)"}}>
        <b style={{color:"var(--bone)",fontWeight:600}}>{s}</b>
        <span style={{color:col}}>{q?.price!=null?Number(q.price).toFixed(2):"—"}</span>
        <span style={{color:col,fontSize:12.5}}>{pct==null?"":(pct>=0?"+":"")+pct.toFixed(2)+"%"}</span>
      </span>
    );
  };
  return (
    <div style={{background:"var(--bg2)",borderBottom:"1px solid var(--line)",overflow:"hidden",padding:"9px 0"}}>
      <div className="tape-track">
        {items.map((s,i)=>cell(s,i))}
        {items.map((s,i)=>cell(s,"b"+i))}
      </div>
    </div>
  );
}

/* Scrolling news + runners ticker — headlines for your watchlist (free Yahoo
   feed) and your latest runner picks, streaming across the top like the price tape. */
function NewsTape({watch}){
  const [news,setNews]=useState([]);
  const [runners,setRunners]=useState([]);
  useEffect(()=>{ (async()=>{ const r=await sGet("runner_scan"); if(r&&Array.isArray(r.rows)) setRunners(r.rows.slice(0,8)); })(); },[]);
  const key=(watch||[]).join(",");
  useEffect(()=>{
    let live=true;
    async function load(){ if(!key) return; try{ const r=await fetch(`/api/news?symbols=${encodeURIComponent(key)}`); const j=await r.json().catch(()=>null); if(live&&j&&Array.isArray(j.items)) setNews(j.items.slice(0,20)); }catch(e){} }
    load(); const id=setInterval(load, 5*60*1000); return ()=>{ live=false; clearInterval(id); };
  },[key]);
  const items=[
    ...runners.map(r=>({type:"runner",sym:r.s,dir:r.dir,score:runnerScore(r)})),
    ...news.map(n=>({type:"news",sym:n.ticker,headline:n.headline,link:n.link,source:n.source})),
  ];
  if(!items.length) return null;
  const cell=(it,i)=> it.type==="runner"
    ? <span key={"c"+i} className="mono" style={{display:"inline-flex",alignItems:"baseline",gap:7,padding:"0 20px",fontSize:13,borderRight:"1px solid var(--line)"}}>
        <span style={{color:"var(--brass)",fontWeight:700}}>🚀 {it.sym}</span>
        <span style={{color:it.dir==="down"?"var(--bear)":"var(--bull)"}}>{it.dir==="down"?"puts":"calls"}</span>
        <span style={{color:"var(--faint)"}}>runner {it.score}</span>
      </span>
    : <a key={"c"+i} href={it.link||undefined} target="_blank" rel="noopener" className="mono" style={{display:"inline-flex",alignItems:"baseline",gap:8,padding:"0 20px",fontSize:13,borderRight:"1px solid var(--line)",textDecoration:"none"}}>
        <b style={{color:"var(--brass)",fontWeight:700}}>{it.sym||"MKT"}</b>
        <span style={{color:"var(--bone)"}}>{it.headline}</span>
        {it.source && <span style={{color:"var(--faint)"}}>· {it.source}</span>}
      </a>;
  const dur=Math.max(50, items.length*8);
  return (
    <div style={{display:"flex",alignItems:"center",background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>
      <span className="mono" style={{fontSize:9.5,letterSpacing:"0.16em",color:"var(--brass-dim)",padding:"0 11px",flexShrink:0,borderRight:"1px solid var(--line)"}}>📰 NEWS</span>
      <div style={{overflow:"hidden",flex:1,padding:"7px 0"}}>
        <div className="tape-track" style={{animationDuration:dur+"s"}}>
          {items.map((it,i)=>cell(it,i))}
          {items.map((it,i)=>cell(it,"b"+i))}
        </div>
      </div>
    </div>
  );
}
/* ============================ TODAY ============================ */
const HelpCtx=React.createContext(true);
function Help({text,align="right"}){
  const show=React.useContext(HelpCtx);
  const [o,setO]=useState(false);
  if(show===false) return null;
  return (
    <span style={{position:"relative",display:"inline-flex",flexShrink:0}}>
      <button onClick={()=>setO(v=>!v)} title="What is this?" className="mono"
        style={{width:20,height:20,borderRadius:"50%",border:"1px solid var(--line2)",background:o?"var(--brass)":"var(--bg)",color:o?"#241A0A":"var(--dim)",fontSize:12.5,fontWeight:800,cursor:"pointer",lineHeight:1,padding:0}}>{o?"×":"?"}</button>
      {o &&
        <span style={{position:"absolute",top:26,[align]:0,zIndex:60,width:250,maxWidth:"78vw",padding:"11px 13px",background:"var(--bg3)",border:"1px solid var(--line2)",borderRadius:10,fontSize:13.5,lineHeight:1.55,color:"var(--dim)",boxShadow:"0 10px 30px rgba(0,0,0,0.55)",fontFamily:"'Inter',sans-serif",fontWeight:400,letterSpacing:0,textTransform:"none",textAlign:"left"}}>{text}</span>}
    </span>
  );
}
function tradesToText(list){
  return list.map(t=>{
    const p=computePnl(t);
    const det=t.instrument==="Option"?`${t.optType||""} ${t.strike||""} exp ${t.expiry||""}`.trim():t.instrument;
    return `${t.date} ${t.ticker} ${det} ${t.direction} · setup ${t.setup} · ${t.horizon||"?"}/${t.timeframe||"?"} · in ${t.entry||"?"}→out ${t.exit||"?"} x${t.quantity||"?"} · P&L ${fmtMoney(p)} · plan ${t.planFollowed?"followed":"NOT followed"} · ${t.emotion||""}${t.notes?` · ${t.notes}`:""}`;
  }).join("\n");
}
const AGENT_ACTIONS=[
  ["read","🎯 Read the market now","Live bias + am I near a trigger?"],
  ["brief","🌅 Pre-market brief","Bias, calendar & both branches"],
  ["eod","📓 EOD discipline review","Grades today vs. your pipeline"],
  ["weekly","📊 Weekly scorecard","Win rate, avg win/loss, the one fix"],
];
async function withKB(system){
  try{ const kb=await sGet("coach:kb"); if(Array.isArray(kb)&&kb.length) return system+"\n\n=== THIS TRADER'S KNOWLEDGE BASE (authoritative — use it) ===\n"+kb.map(k=>"• "+k.title+": "+k.content).join("\n"); }catch(e){}
  return system;
}
function AgentActions({trades,watch}){
  const [out,setOut]=useState(""); const [loading,setLoading]=useState(""); const [err,setErr]=useState(""); const [ran,setRan]=useState("");
  const [readSym,setReadSym]=useState("IWM");
  async function run(kind){
    setLoading(kind); setErr(""); setOut(""); setRan(kind);
    try{
      let system,user,tools;
      if(kind==="read"){
        system=await withKB(MENTOR_SYS+`\n\nTASK — Read the market RIGHT NOW for the ticker I name. Search for its latest price and recent move. RULES ON DATA HONESTY: today is ${todayISO()}. First determine if the US market is OPEN right now (Mon–Fri ~9:30am–4pm ET, not a holiday). If it is CLOSED (weekend/after-hours/pre-market), SAY SO plainly and label every price as "last close / delayed — verify on your broker." Do NOT invent an intraday high/low/volume or narrate a session that didn't happen. If you cannot verify a live price, say so. Then: (1) bias (bullish/bearish/neutral) from structure, one line + confidence %; (2) where price sits vs. the ticker's key levels (support/resistance, and for IWM my saved 292–294 / 287–288 levels) AND vs. its 50 EMA / VWAP (above both = bullish trend, below both = bearish, between EMAs = chop/no-man's-land — call it out); (3) is a trigger CLOSE (a real 2-up/2-down setup near) — yes/no; if yes give exact trigger, stop, targets, and a contract per my defaults (delta 0.55–0.70, right DTE, not far-OTM 0DTE); if no, say "NO TRADE — wait." (4) flag any imminent catalyst (earnings for a stock; ISM/jobs/Fed for indices). Blunt, fast, never a guaranteed call. Always tell me to confirm the live price on my own screen before acting.`);
        user=`Read ${readSym||"IWM"} right now. Today is ${todayISO()}.${(readSym||"IWM")==="IWM"?" My saved IWM bias: bearish descending channel; short trigger = bounce into 292–294 + 2-down OR break/hold below 287–288; invalidation above ~294; targets 287–288 → 284 → 282.":""}`;
        tools=[{type:"web_search_20250305",name:"web_search"}];
      } else if(kind==="brief"){
        system=await withKB(MENTOR_SYS+"\n\nTASK — Pre-market brief. Give today's IWM read: Daily/60m bias & FTFC, my key levels, any ISM/Fed/CPI/jobs on the calendar today, then BOTH branches — my 2-up plan and my 2-down plan, each with trigger, stop, target, and a contract per my defaults (delta 0.55–0.70, right DTE). Flag IV-crush risk. Concise. End with one line 'Bias:'.");
        user=`Pre-market brief for ${todayISO()}. Watchlist leads with IWM.`;
        tools=[{type:"web_search_20250305",name:"web_search"}];
      } else if(kind==="eod"){
        const today=trades.filter(t=>t.date===todayISO());
        const list=today.length?today:[...trades].slice(-8);
        system=await withKB(MENTOR_SYS+"\n\nTASK — End-of-day discipline review. Grade each trade against my 6-step pipeline. Score my DISCIPLINE (real trigger? sized off the stop? scaled out into strength? closed 0DTE before 3:30? right strike/DTE?) — not just P&L. Call out any far-OTM or held-to-zero behavior directly. End with one line: did I trade my plan?");
        user=(today.length?"Today's trades:\n":"No trades logged today — review my most recent trades instead:\n")+tradesToText(list);
      } else {
        const sow=startOfWeek(); const wk=trades.filter(t=>new Date(t.date)>=sow);
        const list=wk.length?wk:[...trades].slice(-15);
        system=await withKB(MENTOR_SYS+"\n\nTASK — Weekly scorecard. From these trades report: win rate, average win vs average loss, profit factor, and % where I followed my plan. Then name the ONE behavior costing me the most and one to double down on. Numbers first, then the two takeaways. Be blunt.");
        user=(wk.length?"This week's trades:\n":"No trades this week — use my recent trades:\n")+tradesToText(list);
      }
      let data;
      try{ data=await callClaude({ maxTokens:1000, system, messages:[{role:"user",content:user}], tools }); }
      catch(e){ if(tools){ data=await callClaude({ maxTokens:1000, system, messages:[{role:"user",content:user}] }); } else throw e; }
      setOut(getText(data)||"No response — try again.");
    }catch(e){ setErr((e&&e.message&&/api key/i.test(e.message))?e.message:"Couldn't reach the AI. If you're on the hosted/standalone version, tap 🔑 (top-right) and add your Anthropic API key. In-app, check your connection and retry."); }
    setLoading("");
  }
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Your agent</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>One-tap coaching</h3><Help text="Runs the mentor coach on your real journal + knowledge base. Read the market (any ticker), a pre-market brief, an end-of-day discipline grade, or a weekly scorecard. Educational and probability-first — never a guaranteed call."/></div>
      <p style={{margin:"0 0 14px",fontSize:14,color:"var(--dim)"}}>Runs on your real journal + everything you've taught the agent. Educational, probability-first — never a guaranteed call.</p>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12,flexWrap:"wrap"}}>
        <span className="eyebrow">Read ticker</span>
        <select value={(watch||[]).includes(readSym)?readSym:(watch&&watch[0])||"IWM"} onChange={e=>setReadSym(e.target.value)} className="mono"
          style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--brass)",borderRadius:8,padding:"7px 12px",fontSize:14.5,outline:"none",cursor:"pointer",minWidth:110}}>
          {(watch&&watch.length?watch:["IWM"]).map(w=><option key={w} value={w}>{w}</option>)}
        </select>
        <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>← tap “Read the market now”</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        {AGENT_ACTIONS.map(([k,label,sub])=>(
          <button key={k} onClick={()=>run(k)} disabled={!!loading}
            style={{textAlign:"left",padding:"12px 13px",borderRadius:11,cursor:"pointer",
              background:ran===k?"rgba(227,168,87,0.08)":"var(--bg)",border:"1px solid "+(ran===k?"var(--brass-dim)":"var(--line2)")}}>
            <div className="disp" style={{fontSize:15,fontWeight:700,color:"var(--bone)"}}>{loading===k?<span className="spin"/>:label}</div>
            <div style={{fontSize:12.5,color:"var(--dim)",marginTop:3,lineHeight:1.35}}>{sub}</div>
          </button>
        ))}
      </div>
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:10}}>{err}</div>}
      {out && <div style={{marginTop:14,padding:15,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11,fontSize:15,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{out}</div>}
    </div>
  );
}

const CONFIRMS=[
  "FTFC — Daily & 60m agree with my direction",
  "At a level / supply-demand zone (not mid-range)",
  "Real trigger fired (2-up/2-down break of prior bar)",
  "Trend-aligned (price + 50 EMA / VWAP agree with my direction)",
  "Volume confirms (expansion in my direction)",
  "Not buying premium into an IV-crush event",
  "Stop is defined (max 40–50% on the option)",
];
const CONFIRM_DEFS={
  "FTFC — Daily & 60m agree with my direction":"Full Time Frame Continuity — your bias timeframes (Daily and 60m) are the same color as your trade direction. Trading WITH continuity is the highest-odds environment; against it you're fighting the tide.",
  "At a level / supply-demand zone (not mid-range)":"Price is AT a meaningful level — a prior pivot, supply/demand zone, or key support/resistance — not floating mid-range where there's nothing to react to. Levels are where moves start and stop.",
  "Real trigger fired (2-up/2-down break of prior bar)":"An actual signal put you in — a 2-up break of the prior bar's high (long) or 2-down break of its low (short). No trigger = you're anticipating, and that's how accounts bleed. No break, no trade.",
  "Trend-aligned (price + 50 EMA / VWAP agree with my direction)":"The trend filter: for a LONG, price is above the 50 EMA and above VWAP (bullish); for a SHORT, price is below both (bearish). Trading a trigger WITH the 50 EMA/VWAP trend is higher-odds than one stuck between the EMAs in no-man's-land. This is optional/experimental — check it on your trades and compare your win rate on trend-aligned vs not, so YOUR data tells you if it helps. Don't force it; it's a filter, not a signal.",
  "Volume confirms (expansion in my direction)":"Volume is expanding on the move in your direction — that confirms real participation. A breakout on light/contracting volume often fails; expansion is the tell that it's real.",
  "Not buying premium into an IV-crush event":"You're not buying options right before an event (earnings, Fed, CPI) that will crush IV afterward. IV crush can wipe out a long option even when you nailed the direction. Check the calendar first.",
  "Stop is defined (max 40–50% on the option)":"You've set your exit BEFORE entering — derived from the invalidation level, capped at 40–50% of premium. Zero is never the stop. If you can't say where you're wrong, you don't have a trade.",
};
/* Pull the underlying price out of an alert string like "… stock @ 293.0". */
function alertLevel(s){ const m=String(s||"").match(/@\s*\$?\s*(\d+(?:\.\d+)?)/); return m?Number(m[1]):null; }

function ExamineNextTrade({watch,lockSym,prefill,showScan=true,idx,onRemove}){
  const [uid]=useState(()=>"exwl"+Math.random().toString(36).slice(2,7));
  const [sym,setSym]=useState(lockSym||"IWM");
  const [dir,setDir]=useState("Long");
  useEffect(()=>{ if(lockSym) setSym(lockSym); },[lockSym]);
  const [entry,setEntry]=useState(""); const [stop,setStop]=useState(""); const [target,setTarget]=useState(""); const [qty,setQty]=useState("1"); const [delta,setDelta]=useState(""); const [riskBudget,setRiskBudget]=useState("");
  const [plan,setPlan]=useState(null); const [filled,setFilled]=useState(false); const [inval,setInval]=useState(""); const [strikeInfo,setStrikeInfo]=useState(""); const [moneyness,setMoneyness]=useState(""); const [theta,setTheta]=useState(""); const [bid,setBid]=useState(""); const [ask,setAsk]=useState("");
  const [sellPrice,setSellPrice]=useState(""); const [alerts,setAlerts]=useState([]); const [alertInput,setAlertInput]=useState("");
  const [live,setLive]=useState(null); const [liveErr,setLiveErr]=useState(""); const [liveBusy,setLiveBusy]=useState(false); const [notify,setNotify]=useState(false); const firedRef=useRef({});
  const [chatOpen,setChatOpen]=useState(false); const [msgs,setMsgs]=useState([]); const [chatInput,setChatInput]=useState(""); const [chatBusy,setChatBusy]=useState(false);
  const [legs,setLegs]=useState([{q:"",p:""},{q:"",p:""},{q:"",p:""}]);
  const [actStrike,setActStrike]=useState(""); const [actBuy,setActBuy]=useState(""); const [actSell,setActSell]=useState(""); const [actQty,setActQty]=useState("");
  const [scanning,setScanning]=useState(false); const [scanErr,setScanErr]=useState(""); const [scanTime,setScanTime]=useState(null);
  useEffect(()=>{ if(prefill) setPlan(prefill); },[prefill]);
  useEffect(()=>{
    if(!plan) return;
    const side = dir==="Short" ? plan.bear : plan.bull;
    const b = side && side.calc;
    if(b && (b.entry!=null||b.target!=null||b.delta!=null)){
      const bidV=b.bid!=null?Number(b.bid):null;
      const askV=b.ask!=null?Number(b.ask):null;
      const mid=(bidV!=null&&askV!=null&&askV>=bidV)?(bidV+askV)/2:null;
      const ep=mid!=null?Number(mid.toFixed(2)):(b.entry!=null?Number(b.entry):null);
      const dl=b.delta!=null?Number(b.delta):null;
      setEntry(ep!=null?String(ep):"");
      setBid(bidV!=null?String(bidV):""); setAsk(askV!=null?String(askV):"");
      setTarget(b.target!=null?String(b.target):"");
      setDelta(dl!=null?String(dl):"");
      const t1=b.target!=null?Number(b.target):null, t2=b.target2!=null?Number(b.target2):null, t3=b.target3!=null?Number(b.target3):null;
      setLegs(ls=>[{q:ls[0].q||"",p:t1!=null?String(t1):""},{q:ls[1].q||"",p:t2!=null?String(t2):""},{q:ls[2].q||"",p:t3!=null?String(t3):""}]);
      let sp=null;
      if(ep!=null && dl!=null && b.entryLevel!=null && b.invalidation!=null){
        const dist=Math.abs(Number(b.entryLevel)-Number(b.invalidation));
        sp=Math.max(0.01, ep - dist*dl);
      } else if(b.stop!=null){ sp=Number(b.stop); }
      else if(ep!=null){ sp=ep*0.55; }
      setStop(sp!=null?String(Number(sp.toFixed(2))):"");
      setInval(b.invalidation!=null?String(b.invalidation):"");
      setStrikeInfo(side&&side.strike?String(side.strike):"");
      setMoneyness(side&&side.moneyness?String(side.moneyness):"");
      setTheta(side&&side.theta?String(side.theta):"");
      setSellPrice(b.target!=null?String(b.target):"");
      const seed=[];
      if(b.entryLevel!=null) seed.push(`Entry trigger — stock @ ${b.entryLevel}`);
      if(b.invalidation!=null) seed.push(`Stop / invalidation — stock @ ${b.invalidation}`);
      if(side&&side.targets) seed.push(`Take profit — ${side.targets}`);
      setAlerts(seed);
      setFilled(true);
    } else {
      setEntry(""); setStop(""); setTarget(""); setDelta(""); setInval(""); setStrikeInfo(""); setMoneyness(""); setTheta(""); setBid(""); setAsk(""); setSellPrice(""); setAlerts([]); setLegs([{q:"",p:""},{q:"",p:""},{q:"",p:""}]); setFilled(false);
    }
  },[plan,dir]);
  async function checkLive(){
    const s=(sym||"").toUpperCase(); if(!s) return;
    setLiveBusy(true);
    try{
      const r=await fetch(`/api/ohlc?symbol=${encodeURIComponent(s)}&interval=5m&range=1d`);
      const j=await r.json().catch(()=>null);
      const bars=(j&&Array.isArray(j.bars))?j.bars:null;
      if(!bars||!bars.length){ setLiveErr((j&&j.error)||"no price"); setLiveBusy(false); return; }
      const price=Number(bars[bars.length-1].c); setLive({price,at:Date.now()}); setLiveErr("");
      if(notify && typeof Notification!=="undefined" && Notification.permission==="granted"){
        alerts.forEach(a=>{ const lv=alertLevel(a); if(lv==null) return;
          const thr=Math.max(0.1, lv*0.0015); const hit=Math.abs(price-lv)<=thr;
          if(hit && !firedRef.current[a]){ firedRef.current[a]=true; try{ new Notification(`${s} @ $${price.toFixed(2)}`,{body:a}); }catch(e){} }
          else if(!hit){ firedRef.current[a]=false; }
        });
      }
    }catch(e){ setLiveErr("check failed"); }
    setLiveBusy(false);
  }
  useEffect(()=>{
    const has=alerts.some(a=>alertLevel(a)!=null);
    if(!has){ setLive(null); return; }
    checkLive();
    const iv=setInterval(checkLive,60000);
    return ()=>clearInterval(iv);
  },[sym, alerts.length, notify]);
  const toggleNotify=async()=>{
    if(notify){ setNotify(false); return; }
    if(typeof Notification==="undefined"){ setLiveErr("notifications not supported here"); return; }
    let perm=Notification.permission;
    if(perm!=="granted") perm=await Notification.requestPermission();
    if(perm==="granted"){ setNotify(true); firedRef.current={}; checkLive(); } else setLiveErr("notifications blocked in browser");
  };
  async function scanFill(){
    if(scanning) return; setScanning(true); setScanErr("");
    try{
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — Build a two-sided option plan for ${sym} to auto-fill my risk calculator AND show callouts. Search the latest price (if the market is closed use last close; never invent an intraday session). The two sides must have DIFFERENT premium estimates. The STOP is NOT a flat percentage — give me the underlying invalidation LEVEL (the price where the trade is wrong) and my calculator derives the stop from it via delta. Return ONLY JSON, no prose/fences, "calc" FIRST in each side: {"price":"current or last price + daily % change + open/closed note, e.g. $289.82 ▼ −0.6% today · last close 8/2","bull":{"calc":{"entry":<est call premium #>,"bid":<est bid #>,"ask":<est ask #>,"target":<est premium at T1 #>,"target2":<est premium at T2 #>,"target3":<est premium at T3 #>,"delta":<0–1 #>,"entryLevel":<underlying entry/trigger price #>,"invalidation":<underlying price where the LONG is wrong #>},"strike":"call strike","moneyness":"ITM or OTM by $X vs the current price (or ATM)","theta":"≈ −$X per contract per day time decay","trigger":"level & 2-up, ≤20 words","targets":"T1 → T2 → T3, ≤14 words"},"bear":{"calc":{"entry":<est PUT premium #>,"bid":<est bid #>,"ask":<est ask #>,"target":<#>,"target2":<#>,"target3":<#>,"delta":<#>,"entryLevel":<underlying entry/trigger #>,"invalidation":<underlying price where the SHORT is wrong #>},"strike":"put strike","moneyness":"ITM or OTM by $X (or ATM)","theta":"≈ −$X/contract/day","trigger":"≤20 words","targets":"≤14 words"}}. Near-money strikes (delta 0.55–0.70), never far-OTM. Premiums/deltas/levels are ESTIMATES.`);
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Two-sided option plan for ${sym}. Today is ${todayISO()}. Include current price + daily % move; different premiums for call vs put; include the invalidation level for each side.`}] });
      const j=extractJson(getText(res));
      if(j&&(j.bull||j.bear)){ setPlan(j); setScanTime(Date.now()); logScan("Two-sided", [sym], [{s:String(sym||"").toUpperCase(),note:String(j.bias||j.read||"both sides").slice(0,40)}]); } else setScanErr("Couldn't fetch a plan — enter the numbers manually.");
    }catch(e){ setScanErr(aiErr(e,"Scan")+" — or enter the numbers manually."); }
    setScanning(false);
  }
  const [checks,setChecks]=useState({});
  const [out,setOut]=useState(""); const [loading,setLoading]=useState(false); const [err,setErr]=useState("");
  const e=num(entry), s=num(stop), tg=num(target), q=num(qty)||1;
  // premium-based: risk = (entry-stop)*contracts*100, reward = (target-entry)*contracts*100
  const riskD = (e!=null&&s!=null&&e>s) ? (e-s)*q*100 : null;
  const rewardD = (e!=null&&tg!=null&&tg>e) ? (tg-e)*q*100 : null;
  const stopPct = (e!=null&&s!=null&&e>0) ? Math.round((e-s)/e*100) : null;
  const rr=(riskD>0&&rewardD>0)?rewardD/riskD:null;
  const perMove=(num(delta)>0)?num(delta)*100*q:null;
  const movesToTarget=(perMove>0&&rewardD>0)?rewardD/perMove:null;
  const rpc=(e!=null&&s!=null&&e>s)?(e-s)*100:null;
  const costPer=(e!=null&&e>0)?e*100:null;
  const budget=num(riskBudget);
  const sizedQty=(budget>0&&costPer>0)?Math.floor(budget/costPer):null;
  const actualCost=(sizedQty!=null&&costPer!=null)?sizedQty*costPer:null;
  const actualRisk=(sizedQty!=null&&rpc!=null)?sizedQty*rpc:null;
  useEffect(()=>{ if(sizedQty!=null&&sizedQty>=1) setQty(String(sizedQty)); },[sizedQty]);
  useEffect(()=>{
    const n=num(qty)||0; if(n<1) return;
    let a,b2,c;
    if(n===1){a=1;b2=0;c=0;} else if(n===2){a=1;b2=1;c=0;} else {const base=Math.floor(n/3);a=base;b2=base;c=n-2*base;}
    setLegs(ls=>[{q:String(a),p:ls[0].p},{q:String(b2),p:ls[1].p},{q:String(c),p:ls[2].p}]);
  },[qty]);
  const setLeg=(i,k,v)=>setLegs(x=>x.map((l,j)=>j===i?{...l,[k]:v}:l));
  const legProfit=(l)=>{ const p=num(l.p), qn=num(l.q); return (p!=null&&qn!=null&&e!=null)?(p-e)*qn*100:null; };
  const bankedTotal=legs.reduce((a,l)=>{const v=legProfit(l);return a+(v||0);},0);
  const soldTotal=legs.reduce((a,l)=>a+(num(l.q)||0),0);
  const actPnl=(num(actBuy)!=null&&num(actSell)!=null&&num(actQty)!=null)?(num(actSell)-num(actBuy))*num(actQty)*100:null;
  const splitEven=()=>{ const n=num(qty)||0; if(n<1)return; const base=Math.floor(n/3); setLegs([{q:String(base||1),p:target||""},{q:String(base||0),p:""},{q:String(n-2*base),p:""}]); };
  const addScaleAlerts=()=>{
    const ns=[];
    ["T1","T2","Runner"].forEach((lbl,i)=>{ const l=legs[i]; if((num(l.q)||0)>0 && num(l.p)!=null){ ns.push(`Scale out ${lbl} — sell ${l.q} at $${l.p} premium`); } });
    if(ns.length) setAlerts(a=>[...a.filter(x=>!/^Scale out /.test(x)), ...ns]);
  };
  const nConf=CONFIRMS.filter(c=>checks[c]).length;
  const rv=rr==null?null:rr>=3?["✓ Go — meets 1:3","var(--bull)"]:rr>=2?["~ Marginal","var(--brass)"]:["✗ Skip — under 1:2","var(--bear)"];
  const toggle=c=>setChecks(x=>({...x,[c]:!x[c]}));
  async function examine(){
    if(loading) return; setLoading(true); setErr(""); setOut("");
    try{
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — Vet a trade I'm STUDYING to take on ${sym} (${dir}). Search its current read (price/structure; if the market is closed say so and label price last-close — never invent an intraday session). Coach me like a pre-trade checklist: (1) Risk/reward — entry $${entry||"?"}, stop $${stop||"?"}${stopPct!=null?` (${stopPct}% loss)`:""}, target $${target||"?"}, ${q} contract(s), delta ${delta||"?"} (≈ $${perMove!=null?perMove.toFixed(0):"?"} P&L per $1 the stock moves${movesToTarget!=null?`, needs ~${movesToTarget.toFixed(1)} pts to target`:""}) → risk $${riskD!=null?riskD.toFixed(0):"?"}, reward $${rewardD!=null?rewardD.toFixed(0):"?"}, RR ${rr?rr.toFixed(1):"?"}:1. My gate: 1:3+ = go, under 1:2 = skip; and my stop should be ≤40–50% of premium. (2) I have ${nConf}/${CONFIRMS.length} confirmations — multiple real reasons or forcing it? (3) Is there an ACTUAL trigger or would I jump in early? (4) TREND FILTER: is price ${dir==="Short"?"BELOW":"ABOVE"} its 50 EMA and VWAP (trend-aligned for a ${dir.toLowerCase()}), or stuck between the EMAs in no-man's-land? Trend-aligned is higher-odds; mid-EMA chop is a warning. Remind me: delta matters more than strike for a day trade. Finish with a clear GO / WAIT / SKIP and one line why. Blunt, ≤150 words.`);
      const res=await callClaude({ maxTokens:900, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Examine my ${dir} idea on ${sym}. Entry $${entry||"?"}, stop $${stop||"?"}, target $${target||"?"}, ${q} contracts → risk $${riskD!=null?riskD.toFixed(0):"?"}, reward $${rewardD!=null?rewardD.toFixed(0):"?"}, RR ${rr?rr.toFixed(1):"?"}:1. Reasons checked: ${CONFIRMS.filter(c=>checks[c]).join("; ")||"none"}. Today is ${todayISO()}.`}] });
      setOut(getText(res)||"No response — try again.");
    }catch(err){ setErr(aiErr(err,"Examine")); }
    setLoading(false);
  }
  async function sendChat(){
    const q=chatInput.trim(); if(!q||chatBusy) return;
    const hist=[...msgs,{role:"user",content:q}];
    setMsgs(hist); setChatInput(""); setChatBusy(true);
    try{
      const ctx=`Trade being examined: ${sym} ${dir}${strikeInfo?` (${strikeInfo})`:""} — entry $${entry||"?"}, stop $${stop||"?"}, target $${target||"?"}, delta ${delta||"?"}, ${qty} contract(s)${riskD!=null?`, risk ${fmtMoney(riskD)}`:""}${rewardD!=null?`, reward ${fmtMoney(rewardD)}`:""}${rr?`, RR ${rr.toFixed(1)}:1`:""}${inval?`, invalidation @ ${inval}`:""}. Confirmations: ${CONFIRMS.filter(c=>checks[c]).join("; ")||"none"}.`;
      const sys=await withKB(MENTOR_SYS+`\n\nYou're discussing ONE specific trade the trader is examining right now. ${ctx}\nAnswer their questions about THIS trade — sizing, entry timing, setup quality, adjustments, whether to take or skip. Probability + defense first, tie to their rules, educational and concise. You may search for current market info if asked. Today is ${todayISO()}.`);
      const res=await callClaude({ maxTokens:700, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:hist.map(m=>({role:m.role,content:m.content})) });
      setMsgs([...hist,{role:"assistant",content:getText(res)||"(no response)"}]);
    }catch(e){ setMsgs([...hist,{role:"assistant",content:"("+aiErr(e,"Reply")+")"}]); }
    setChatBusy(false);
  }
  const fld={fontFamily:"inherit",background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--bone)",borderRadius:8,padding:"9px 11px",fontSize:14.5,outline:"none"};
  const D_={
    entry:"The premium (price) you PAY per contract — not the strike. Your P&L moves from this number.",
    stop:"The premium where you exit if you're wrong. Derived from your invalidation level, capped at your 40–50% rule.",
    target:"The premium where you take profit / scale out — estimated from your target stock level via delta.",
    risk:"The most you're willing to LOSE on this trade today. It sizes your contracts so you never risk more than this.",
    qty:"Number of option contracts. Auto-calculated from risk budget ÷ risk-per-contract; you can override it.",
    delta:"How much the option moves per $1 the stock moves, and roughly its odds of finishing in-the-money. Target 0.55–0.70.",
    bid:"The highest price a buyer will pay right now — what you'd receive if you SELL at market.",
    ask:"The lowest price a seller will accept — what you'd pay if you BUY at market. Entry auto-fills to the mid of bid and ask.",
  };
  const lq=(text,def,color)=>(
    <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:3}}>
      <span className="mono" style={{fontSize:11.5,color:color||"var(--faint)"}}>{text}</span>
      <Help align="left" text={def}/>
    </div>
  );
  const ans=(n,label,val,color)=>(
    <div style={{padding:"11px 13px",background:"var(--bg)",border:"1px solid "+(val!=null?(color||"var(--line2)"):"var(--line2)"),borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
      <span className="eyebrow" style={{margin:0}}>{n} · {label}</span>
      <span className="mono" style={{fontSize:15,fontWeight:800,color:val!=null?(color||"var(--bone)"):"var(--faint)"}}>{val!=null?val:"—"}</span>
    </div>
  );
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><div><div className="eyebrow" style={{marginBottom:4}}>Before you click</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>{idx!=null?`Examine trade ${idx+1}`:"Examine next trade"}</h3></div><Help text="Pre-trade calculator + vetting. Punch in your entry, stop, target and contracts — it CALCULATES the three questions: dollar risk if wrong, dollar reward if right, and the risk:reward ratio. Check your reasons to enter, and the coach gives a GO / WAIT / SKIP using your rules + a live read. Gate: 1:3+ RR, stop ≤40–50% of premium, multiple confirmations, a real trigger."/></div>
        {onRemove && <button onClick={onRemove} title="Remove this trade" style={{border:"1px solid var(--line2)",background:"transparent",color:"var(--dim)",borderRadius:7,width:26,height:26,cursor:"pointer",fontSize:14.5,flexShrink:0,lineHeight:1}}>✕</button>}
      </div>
      <p style={{margin:"10px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Enter the numbers — it calculates the three questions that separate a pro from a gambler.</p>

      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {lockSym
          ? <div className="mono" style={{...fld,flex:"1 1 120px",fontWeight:700,color:"var(--brass)",display:"flex",alignItems:"center"}}>{sym}</div>
          : <><input list={uid} value={sym} onChange={e2=>setSym(e2.target.value.toUpperCase())} className="mono" style={{...fld,flex:"1 1 120px",fontWeight:700,color:"var(--brass)"}}/>
            <datalist id={uid}>{(watch||["IWM"]).map(w=><option key={w} value={w}/>)}</datalist></>}
        <div style={{display:"flex",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:8,padding:3}}>
          {["Long","Short"].map(d=><button key={d} onClick={()=>setDir(d)} className="mono" style={{border:"none",padding:"7px 14px",fontSize:13.5,fontWeight:700,borderRadius:6,cursor:"pointer",background:dir===d?(d==="Long"?"var(--bull)":"var(--bear)"):"transparent",color:dir===d?"#0E1116":"var(--dim)"}}>{d}</button>)}
        </div>
      </div>

      {showScan &&
        <div style={{marginBottom:12}}>
          <button className="btn" style={{width:"100%"}} onClick={scanFill} disabled={scanning}>{scanning?<span className="spin"/>:`🎯 Scan ${sym} & auto-fill both sides`}</button>
          {scanErr && <div style={{color:"var(--bear)",fontSize:13,marginTop:6}}>{scanErr}</div>}
        </div>}

      {plan && plan.price &&
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",padding:"9px 12px",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:10,marginBottom:12}}>
          <span className="mono" style={{fontSize:14,fontWeight:700,color:"var(--bone)"}}>{sym} · {plan.price}</span>
          {scanTime && <span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>scanned {new Date(scanTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
        </div>}

      {plan && (()=>{ const b=dir==="Short"?plan.bear:plan.bull; if(!b||(!b.strike&&!b.trigger&&!b.targets)) return null; return (
        <div style={{marginBottom:12,padding:"11px 13px",background:"var(--bg)",border:"1px solid "+(dir==="Short"?"var(--bear)":"var(--bull)"),borderRadius:10}}>
          <div className="eyebrow" style={{marginBottom:6,color:dir==="Short"?"var(--bear)":"var(--bull)"}}>Suggested {dir.toLowerCase()} callout — feeds the calc below</div>
          {b.strike && <div style={{fontSize:13.5,color:"var(--bone)",lineHeight:1.5}}><b>Strike:</b> {b.strike}</div>}
          {b.trigger && <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.5,marginTop:2}}><b style={{color:"var(--bone)"}}>Trigger:</b> {b.trigger}</div>}
          {b.targets && <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.5,marginTop:2}}><b style={{color:"var(--bone)"}}>Targets:</b> {b.targets}</div>}
        </div>
      ); })()}

      {/* trade math inputs */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
          <div className="eyebrow" style={{margin:0}}>Trade math — premium per contract</div>
          {strikeInfo && <span className="mono" style={{fontSize:12.5,fontWeight:800,color:"var(--brass)",padding:"3px 9px",borderRadius:5,background:"var(--bg3)",border:"1px solid var(--brass-dim)"}}>{strikeInfo}</span>}
          {(moneyness||theta) && <Help align="left" text="ITM (in-the-money): the strike is already on the profitable side of the stock — pricier, higher delta, less that has to happen. OTM (out-of-the-money): not yet profitable at expiry — cheaper, lower delta, needs the move to come. Theta (time decay): how much premium the option bleeds each day just from time passing; it speeds up near expiry — the reason cheap short-dated options die fast."/>}
        </div>
        {filled && <span className="mono" style={{fontSize:11,color:"var(--bull)"}}>✓ filled from scan · confirm on chain</span>}
      </div>
      {(moneyness||theta) &&
        <div className="mono" style={{fontSize:12.5,marginBottom:8,display:"flex",gap:12,flexWrap:"wrap"}}>
          {moneyness && <span style={{color:/\bITM\b/i.test(moneyness)?"var(--bull)":/\bOTM\b/i.test(moneyness)?"var(--bear)":"var(--dim)"}}>{moneyness}</span>}
          {theta && <span style={{color:"var(--bear)"}}>θ {theta} <span style={{color:"var(--faint)"}}>time decay</span></span>}
        </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
        <div>{lq("Entry $",D_.entry)}<input value={entry} onChange={e2=>setEntry(e2.target.value)} className="mono" placeholder="1.00" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
        <div>{lq("Stop $",D_.stop)}<input value={stop} onChange={e2=>setStop(e2.target.value)} className="mono" placeholder="0.55" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
        <div>{lq("Target $",D_.target)}<input value={target} onChange={e2=>setTarget(e2.target.value)} className="mono" placeholder="3.00" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
        <div>{lq("Bid $",D_.bid)}<input value={bid} onChange={e2=>{setBid(e2.target.value); const bv=num(e2.target.value),av=num(ask); if(bv!=null&&av!=null&&av>=bv)setEntry(String(Number(((bv+av)/2).toFixed(2))));}} className="mono" placeholder="2.38" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
        <div>{lq("Ask $",D_.ask)}<input value={ask} onChange={e2=>{setAsk(e2.target.value); const av=num(e2.target.value),bv=num(bid); if(bv!=null&&av!=null&&av>=bv)setEntry(String(Number(((bv+av)/2).toFixed(2))));}} className="mono" placeholder="2.52" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
      </div>
      {(num(bid)!=null&&num(ask)!=null&&num(ask)>=num(bid)) && <div className="mono" style={{fontSize:12,color:"var(--dim)",marginBottom:8,lineHeight:1.5}}>Spread ${(num(ask)-num(bid)).toFixed(2)} · mid ${((num(bid)+num(ask))/2).toFixed(2)} — buy near the ask, sell near the bid; a wide spread eats your edge.</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:6}}>
        <div>{lq("Risk today $",D_.risk,"var(--brass)")}<input value={riskBudget} onChange={e2=>setRiskBudget(e2.target.value)} className="mono" placeholder="200" style={{...fld,width:"100%",padding:"8px 9px",borderColor:budget>0?"var(--brass-dim)":"var(--line2)"}}/></div>
        <div>{lq("Contracts",D_.qty)}<input value={qty} onChange={e2=>setQty(e2.target.value)} className="mono" placeholder="1" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
        <div>{lq("Delta (0–1)",D_.delta)}<input value={delta} onChange={e2=>setDelta(e2.target.value)} className="mono" placeholder="0.60" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
      </div>
      {budget>0 && costPer>0 &&
        <div className="mono" style={{fontSize:12,color:sizedQty>=1?"var(--brass)":"var(--bear)",marginBottom:8,lineHeight:1.5}}>
          {sizedQty>=1
            ? `$${budget.toFixed(0)} buys ${sizedQty} contract${sizedQty>1?"s":""} · cost ${fmtMoney(actualCost)}${actualRisk!=null?` · max risk if stopped ${fmtMoney(actualRisk)}`:""}`
            : `$${budget.toFixed(0)} won't buy even 1 contract (${fmtMoney(costPer)} each) — raise the budget or pick a cheaper contract`}
        </div>}
      {stopPct!=null && <div className="mono" style={{fontSize:12,color:stopPct<=50?"var(--bull)":"var(--bear)",marginBottom:8,lineHeight:1.5}}>Stop = {stopPct}% of premium {stopPct<=50?"✓ within your 40–50% guardrail":"⚠ over 40–50% — invalidation is too far, cut size or skip"}{inval?` · derived from invalidation @ ${inval}`:""}</div>}
      {perMove!=null &&
        <div style={{padding:"11px 13px",background:"rgba(63,183,130,0.06)",border:"1px solid var(--bull)",borderRadius:10,marginBottom:12}}>
          <div style={{fontSize:14,color:"var(--bone)",lineHeight:1.5}}>Every <b>$1</b> the stock moves in your favor → <b className="mono" style={{color:"var(--bull)"}}>+{fmtMoney(perMove)}</b> <span style={{color:"var(--dim)"}}>(delta {num(delta).toFixed(2)} × 100 × {q}). That's your real-time P&L speed.</span></div>
          {movesToTarget!=null && <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:5}}>≈ {movesToTarget.toFixed(2)} points of stock movement to hit your target.</div>}
        </div>}

      {/* computed answers */}
      <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:14}}>
        {ans("1","Risk if WRONG", riskD!=null?"−"+fmtMoney(riskD).replace("-",""):null, "var(--bear)")}
        {ans("2","Reward if RIGHT", rewardD!=null?"+"+fmtMoney(rewardD).replace("+",""):null, "var(--bull)")}
        <div style={{padding:"12px 13px",background:"var(--bg)",border:"1px solid "+(rv?rv[1]:"var(--line2)"),borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span className="eyebrow" style={{margin:0}}>3 · Risk : reward</span>
          <span className="mono" style={{fontSize:15,fontWeight:800,color:rv?rv[1]:"var(--faint)"}}>{rr?`1 : ${rr.toFixed(1)} · ${rv[0]}`:"— fill entry/stop/target"}</span>
        </div>
      </div>

      {/* scale-out plan */}
      <div style={{marginBottom:14,padding:"13px 14px",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:11}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div className="eyebrow" style={{margin:0}}>Scale-out plan</div>
            <Help align="left" text="Sell your contracts in pieces into strength instead of all at once — the one habit every green trade in your journal shared. Set how many contracts to sell at each target and the premium you'll sell for; it shows the profit banked at each leg and the total. Keep a 'runner' with its stop trailed to breakeven for the big move."/>
          </div>
          <button className="btn" style={{fontSize:12.5,padding:"5px 10px"}} onClick={splitEven}>Split {qty||"0"} evenly</button>
        </div>
        <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:10,lineHeight:1.5}}>Plan: sell ~⅓ at T1, ~⅓ at T2, let the runner ride to T3. The moment T1 fills, move the runner's stop to breakeven — now it's a free trade and you can't lose.</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {["T1","T2","Runner"].map((lbl,i)=>{ const v=legProfit(legs[i]); return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
              <span className="mono" style={{fontSize:12.5,fontWeight:700,color:"var(--brass)",width:46,flexShrink:0}}>{lbl}</span>
              <input value={legs[i].q} onChange={e2=>setLeg(i,"q",e2.target.value)} placeholder="qty" className="mono" style={{...fld,width:56,padding:"7px 8px",fontSize:13.5}}/>
              <span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>at $</span>
              <input value={legs[i].p} onChange={e2=>setLeg(i,"p",e2.target.value)} placeholder="premium" className="mono" style={{...fld,width:82,padding:"7px 8px",fontSize:13.5}}/>
              <span className="mono" style={{fontSize:13.5,fontWeight:700,color:v!=null?(v>=0?"var(--bull)":"var(--bear)"):"var(--faint)",marginLeft:"auto"}}>{v!=null?(v>=0?"+":"")+fmtMoney(v):"—"}</span>
            </div>
          );})}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,paddingTop:9,borderTop:"1px solid var(--line)",gap:8,flexWrap:"wrap"}}>
          <span className="mono" style={{fontSize:12.5,color:soldTotal>(num(qty)||0)?"var(--bear)":"var(--dim)"}}>Sold {soldTotal} of {qty||0}{soldTotal>(num(qty)||0)?" ⚠ over your position":""}</span>
          <span className="mono" style={{fontSize:15.5,fontWeight:800,color:bankedTotal>=0?"var(--bull)":"var(--bear)"}}>{bankedTotal!==0?(bankedTotal>0?"+":"")+fmtMoney(bankedTotal):"—"} banked</span>
        </div>
        {legs.some(l=>(num(l.q)||0)>0 && num(l.p)!=null) &&
          <button className="btn" style={{width:"100%",marginTop:10,fontSize:13}} onClick={addScaleAlerts}>🔔 Add these scale-outs to my alerts ↓</button>}
      </div>

      {/* strike · sell · alerts */}
      <div style={{marginBottom:14,padding:"13px 14px",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:11}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
          <div className="eyebrow" style={{margin:0}}>Exit plan & alerts</div>
          <Help align="left" text="Your exit and the levels to watch. Strike = the contract. Sell at = the option premium where you take profit / scale out. Alerts = the underlying stock levels that matter (entry trigger, stop/invalidation, take-profit). The app now checks each level with an '@ price' against the live price while it's open — badging HIT or how far away — and can pop a browser alert. Still set them on your broker/TradingView too, for when the app is closed."/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:11}}>
          <div><div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:3}}>Strike / contract</div><div className="mono" style={{...fld,padding:"8px 9px",fontWeight:700,color:"var(--brass)"}}>{strikeInfo||"—"}</div></div>
          <div><div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:3}}>Sell at $ (take profit)</div><input value={sellPrice} onChange={e2=>setSellPrice(e2.target.value)} className="mono" placeholder="target premium" style={{...fld,width:"100%",padding:"8px 9px",color:"var(--bull)",fontWeight:700}}/></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
          <span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>🔔 Alerts — live vs {(sym||"").toUpperCase()}</span>
          {live && <span className="mono" style={{fontSize:11.5}}>· <b style={{color:"var(--brass)"}}>${live.price.toFixed(2)}</b> <span style={{color:"var(--faint)"}}>@ {new Date(live.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></span>}
          {liveErr && <span className="mono" style={{fontSize:11,color:"var(--bear)"}}>{liveErr}</span>}
          <span style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button className="btn" onClick={checkLive} disabled={liveBusy} style={{padding:"3px 9px",fontSize:11}} title="Refresh live price">{liveBusy?"…":"↻ check"}</button>
            <button className="btn" onClick={toggleNotify} style={{padding:"3px 9px",fontSize:11,borderColor:notify?"var(--brass)":"var(--line2)",color:notify?"var(--brass)":"var(--dim)"}} title="Pop a browser alert when a level is hit (while the app is open)">{notify?"🔔 on":"🔔 notify"}</button>
          </span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
          {alerts.length===0 && <div style={{fontSize:13,color:"var(--faint)"}}>Scan or add levels below.</div>}
          {alerts.map((a,i)=>{
            const lv=alertLevel(a); const hit=(lv!=null&&live)?Math.abs(live.price-lv)<=Math.max(0.1,lv*0.0015):false;
            let badge=null;
            if(lv!=null&&live){ const d=live.price-lv;
              badge = hit
                ? <span className="mono" style={{fontSize:11,fontWeight:800,color:"#0b0e13",background:"var(--brass)",padding:"2px 8px",borderRadius:6,flexShrink:0}}>● HIT</span>
                : <span className="mono" style={{fontSize:11.5,flexShrink:0,color:d>0?"var(--bull)":"var(--bear)"}}>{d>0?"▲":"▼"} {Math.abs(d).toFixed(2)} away</span>;
            }
            return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"var(--bg3)",border:"1px solid "+(hit?"var(--brass)":"var(--line)"),borderRadius:8}}>
              <span style={{fontSize:13,color:"var(--bone)",flex:1,lineHeight:1.4}}>{a}</span>
              {badge}
              <button onClick={()=>setAlerts(alerts.filter((_,j)=>j!==i))} style={{border:"none",background:"transparent",color:"var(--faint)",cursor:"pointer",fontSize:13.5,flexShrink:0}}>✕</button>
            </div>
          );})}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={alertInput} onChange={e2=>setAlertInput(e2.target.value)} onKeyDown={e2=>{if(e2.key==="Enter"&&alertInput.trim()){setAlerts([...alerts,alertInput.trim()]);setAlertInput("");}}} placeholder="e.g. alert @ 292.00 break" style={{...fld,flex:1,padding:"8px 10px",fontSize:13.5}}/>
          <button className="btn" onClick={()=>{if(alertInput.trim()){setAlerts([...alerts,alertInput.trim()]);setAlertInput("");}}}>+ Alert</button>
        </div>
      </div>

      {/* actual fill */}
      <div style={{marginBottom:14,padding:"13px 14px",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:11}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
          <div className="eyebrow" style={{margin:0}}>Actual fill — what I placed</div>
          <Help align="left" text="Record the trade you ACTUALLY placed on your broker — the real strike, the price you bought and sold at, and how many contracts. It computes your true P&L. Compare it to the plan above: did you take the setup you meant to, at the size you meant to? Memory lies; the fill doesn't."/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:3}}>Strike placed</div><input value={actStrike} onChange={e2=>setActStrike(e2.target.value)} className="mono" placeholder="e.g. 291 Call" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
          <div><div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:3}}>Contracts</div><input value={actQty} onChange={e2=>setActQty(e2.target.value)} className="mono" placeholder="1" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:3}}>Bought at $</div><input value={actBuy} onChange={e2=>setActBuy(e2.target.value)} className="mono" placeholder="2.45" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
          <div><div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:3}}>Sold at $ (avg)</div><input value={actSell} onChange={e2=>setActSell(e2.target.value)} className="mono" placeholder="4.90" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
        </div>
        {actPnl!=null &&
          <div style={{marginTop:10,paddingTop:9,borderTop:"1px solid var(--line)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span className="eyebrow" style={{margin:0}}>Actual P&L</span>
            <span className="mono" style={{fontSize:16,fontWeight:800,color:actPnl>=0?"var(--bull)":"var(--bear)"}}>{(actPnl>=0?"+":"")+fmtMoney(actPnl)}</span>
          </div>}
      </div>

      <div className="eyebrow" style={{marginBottom:8}}>Reasons to enter <span style={{color:nConf>=2?"var(--bull)":"var(--faint)"}}>({nConf}/6 — want ≥2–3)</span></div>
      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
        {CONFIRMS.map(c=>(
          <div key={c} style={{display:"flex",gap:7,alignItems:"center"}}>
            <label style={{display:"flex",gap:9,alignItems:"center",cursor:"pointer",fontSize:14,color:checks[c]?"var(--bone)":"var(--dim)",flex:1}}>
              <input type="checkbox" checked={!!checks[c]} onChange={()=>toggle(c)} style={{width:15,height:15,accentColor:"var(--brass)",flexShrink:0}}/>{c}
            </label>
            <Help align="left" text={CONFIRM_DEFS[c]||""}/>
          </div>
        ))}
      </div>

      <button className="btn-primary btn" style={{width:"100%"}} onClick={examine} disabled={loading}>{loading?<span className="spin"/>:`🧠 Examine ${sym} with the coach`}</button>
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:8}}>{err}</div>}
      {out && <div style={{marginTop:12,padding:14,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11,fontSize:15,lineHeight:1.6,whiteSpace:"pre-wrap",color:"var(--bone)"}}>{out}</div>}
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:10,lineHeight:1.5}}>Risk = (entry − stop) × contracts × 100. Reward = (target − entry) × contracts × 100. Delta matters more than the strike for a day trade — pick the delta that gives the best risk/reward.</div>

      <div style={{marginTop:14,borderTop:"1px solid var(--line)",paddingTop:12}}>
        <button onClick={()=>setChatOpen(o=>!o)} className="mono" style={{border:"none",background:"transparent",color:"var(--focus)",cursor:"pointer",fontSize:14,fontWeight:700,padding:0,display:"flex",alignItems:"center",gap:6}}>💬 Chat with the coach about this trade <span style={{color:"var(--dim)"}}>{chatOpen?"▾":"▸"}</span></button>
        {chatOpen &&
          <div style={{marginTop:10}}>
            {msgs.length>0 &&
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10,maxHeight:280,overflowY:"auto"}}>
                {msgs.map((m,i)=>(
                  <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"88%",padding:"9px 12px",borderRadius:11,fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap",
                    background:m.role==="user"?"var(--brass-dim)":"var(--bg)",color:m.role==="user"?"#241A0A":"var(--bone)",border:m.role==="user"?"none":"1px solid var(--line)"}}>{m.content}</div>
                ))}
                {chatBusy && <div style={{alignSelf:"flex-start",padding:"9px 12px"}}><span className="spin"/></div>}
              </div>}
            <div style={{display:"flex",gap:8}}>
              <input value={chatInput} onChange={e2=>setChatInput(e2.target.value)} onKeyDown={e2=>{if(e2.key==="Enter")sendChat();}} placeholder={`Ask about this ${sym} trade…`} style={{...fld,flex:1,padding:"9px 11px",fontSize:14}}/>
              <button className="btn-primary btn" onClick={sendChat} disabled={chatBusy||!chatInput.trim()}>Send</button>
            </div>
          </div>}
      </div>
    </div>
  );
}

function ExamineMulti({watch}){
  const [ids,setIds]=useState([1]); const [next,setNext]=useState(2);
  const add=()=>{ setIds(x=>[...x,next]); setNext(n=>n+1); };
  const remove=(id)=>setIds(x=>x.length>1?x.filter(i=>i!==id):x);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {ids.map((id,i)=>(
        <ExamineNextTrade key={id} watch={watch} idx={ids.length>1?i:null} onRemove={ids.length>1?()=>remove(id):null}/>
      ))}
      <button className="btn" onClick={add} style={{alignSelf:"flex-start"}}>+ Add another trade</button>
    </div>
  );
}

function fmtDate(s){
  if(!s) return "—";
  const p=String(s).split("-"); if(p.length!==3) return s;
  const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${M[(+p[1])-1]||p[1]} ${(+p[2])}, ${p[0]}`;
}
function EquityCurve({curve}){
  const w=320,h=92,pad=5;
  if(!curve.length) return <div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12.5,color:"var(--faint)"}}>No closed trades yet</div>;
  const min=Math.min(0,...curve), max=Math.max(0,...curve); const range=(max-min)||1;
  const pts=curve.map((v,i)=>{ const x=pad+(curve.length===1?(w-2*pad)/2:(i/(curve.length-1))*(w-2*pad)); const y=h-pad-((v-min)/range)*(h-2*pad); return [x,y]; });
  const d=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const up=curve[curve.length-1]>=0; const col=up?"var(--bull)":"var(--bear)";
  const zeroY=h-pad-((0-min)/range)*(h-2*pad);
  const area=d+` L ${pts[pts.length-1][0].toFixed(1)} ${h-pad} L ${pts[0][0].toFixed(1)} ${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:"100%",height:h,display:"block"}}>
      <line x1={pad} x2={w-pad} y1={zeroY.toFixed(1)} y2={zeroY.toFixed(1)} stroke="var(--line2)" strokeWidth="1" strokeDasharray="3 3"/>
      <path d={area} fill={col} opacity="0.09"/>
      <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}
function Dashboard({trades,goJournal}){
  const closed=[...trades].filter(t=>computePnl(t)!=null).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const pnls=closed.map(computePnl);
  const total=pnls.reduce((a,b)=>a+b,0);
  const wins=pnls.filter(p=>p>0), losses=pnls.filter(p=>p<0);
  const winPct=closed.length?Math.round(wins.length/closed.length*100):0;
  const avgW=wins.length?wins.reduce((a,b)=>a+b,0)/wins.length:0;
  const avgL=losses.length?Math.abs(losses.reduce((a,b)=>a+b,0)/losses.length):0;
  const plRatio=avgL>0?avgW/avgL:(avgW>0?Infinity:0);
  let cum=0; const curve=closed.map(t=>{cum+=computePnl(t); return cum;});
  const rows=[...closed].reverse();
  const card={background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:14,padding:"16px 18px"};
  const th={textAlign:"left",padding:"9px 12px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--faint)",whiteSpace:"nowrap",borderBottom:"1px solid var(--line)"};
  const td={padding:"11px 12px",fontSize:14,whiteSpace:"nowrap",borderBottom:"1px solid var(--line)"};
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <h2 className="disp" style={{margin:0,fontSize:22,fontWeight:800}}>Dashboard</h2>
        <Help text="Your whole trading record at a glance, from your real journal. Equity curve = running P&L over time. Profit/Loss ratio = average win ÷ average loss (above 1 means winners outweigh losers). Win % = share of trades that made money. Below: every trade with status, entry/exit, return, side, and setup."/>
        <div style={{flex:1}}/>
        <button className="btn-ghost btn" onClick={goJournal}>Open journal →</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,marginBottom:16}}>
        <div style={{...card,gridColumn:"span 1"}}>
          <div className="eyebrow" style={{marginBottom:8}}>Equity curve · running P&L</div>
          <EquityCurve curve={curve}/>
          <div className="mono" style={{fontSize:18,fontWeight:800,color:total>=0?"var(--bull)":"var(--bear)",marginTop:8}}>{closed.length?fmtMoney(total):"—"}</div>
        </div>
        <div style={card}>
          <div className="eyebrow" style={{marginBottom:10}}>Profit / Loss ratio</div>
          <div className="mono" style={{fontSize:30,fontWeight:800,color:plRatio>=1?"var(--bull)":"var(--bear)",lineHeight:1}}>{closed.length?(plRatio===Infinity?"∞":plRatio.toFixed(2)):"—"}<span style={{fontSize:16,color:"var(--dim)"}}> : 1</span></div>
          <div className="mono" style={{fontSize:12.5,color:"var(--faint)",marginTop:8}}>avg win {fmtMoney(avgW)} vs avg loss −{fmtMoney(avgL)}</div>
        </div>
        <div style={card}>
          <div className="eyebrow" style={{marginBottom:10}}>Win %</div>
          <div className="mono" style={{fontSize:30,fontWeight:800,color:"var(--bone)",lineHeight:1}}>{closed.length?winPct+"%":"—"}</div>
          <div className="mono" style={{fontSize:12.5,color:"var(--faint)",marginTop:8}}>{wins.length}W · {losses.length}L · {closed.length} closed</div>
        </div>
        <div style={card}>
          <div className="eyebrow" style={{marginBottom:10}}>Totals</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            <div style={{display:"flex",justifyContent:"space-between"}}><span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>Total P&L</span><span className="mono" style={{fontSize:14.5,fontWeight:800,color:total>=0?"var(--bull)":"var(--bear)"}}>{closed.length?fmtMoney(total):"—"}</span></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>Avg win</span><span className="mono" style={{fontSize:14.5,fontWeight:700,color:"var(--bull)"}}>{fmtMoney(avgW)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>Avg loss</span><span className="mono" style={{fontSize:14.5,fontWeight:700,color:"var(--bear)"}}>−{fmtMoney(avgL)}</span></div>
          </div>
        </div>
      </div>

      <div style={{...card,padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}} className="scroll">
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:660}}>
            <thead><tr>{["Status","Open date","Symbol","Entry","Exit","Return $","Side","Setup"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.length===0
                ? <tr><td colSpan={8} style={{padding:"28px 12px",textAlign:"center",color:"var(--dim)",fontSize:14.5}}>No closed trades yet — log a trade in the Journal and it shows here.</td></tr>
                : rows.map(t=>{ const p=computePnl(t); const win=p>=0; const short=t.direction==="Short"; return (
                  <tr key={t.id}>
                    <td style={td}><span className="mono" style={{fontSize:11.5,fontWeight:800,letterSpacing:"0.05em",padding:"3px 9px",borderRadius:5,color:win?"var(--bull)":"var(--bear)",background:win?"rgba(63,183,130,0.14)":"rgba(231,106,91,0.14)"}}>{win?"WIN":"LOSS"}</span></td>
                    <td style={{...td,color:"var(--dim)"}}>{fmtDate(t.date)}</td>
                    <td style={{...td,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:"var(--bone)"}}>{t.ticker}</td>
                    <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"var(--dim)"}}>{t.entry?"$"+t.entry:"—"}</td>
                    <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"var(--dim)"}}>{t.exit?"$"+t.exit:"—"}</td>
                    <td style={{...td,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:win?"var(--bull)":"var(--bear)"}}>{fmtMoney(p)}</td>
                    <td style={td}><span className="mono" style={{fontSize:11.5,fontWeight:800,letterSpacing:"0.05em",padding:"3px 9px",borderRadius:5,border:"1px solid "+(short?"var(--bear)":"var(--bull)"),color:short?"var(--bear)":"var(--bull)"}}>{short?"SHORT":"LONG"}</span></td>
                    <td style={td}><div style={{display:"flex",gap:5,alignItems:"center"}}><span style={{fontSize:12,padding:"3px 8px",borderRadius:5,background:"var(--bg3)",border:"1px solid var(--line2)",color:"var(--dim)",whiteSpace:"nowrap"}}>{t.setup}</span>{t.grade&&<span className="mono" style={{fontSize:11.5,fontWeight:800,color:gradeColor(t.grade)}}>{t.grade}</span>}</div></td>
                  </tr>
                );})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const LOOP=[
  ["1","Set your goal & read the tone","Open Today. Set a profit goal (the timeframes scale automatically), use the 🧮 Goal calculator to see what each win rate requires, and Build my account to map the path from your real balance. Tap Load futures for the overnight tone — RTY (your IWM index) tells you if you're walking into a gap up or down."],
  ["2","Find the setups","Hit the Strat tab and Scan the watchlist — it flags Nirvana (1-3), Holy Grail (3-1) and full-continuity (FTFC ▲/▼) names, with a ? on each ticker that reads its D/W/M/Q for you. Tap into Watchlist to confirm the chart."],
  ["3","Scan the ticker & auto-fill","On the Today “Examine next trade” card (or any Watchlist ticker) tap “Scan & auto-fill both sides.” It fills the calculator from the callout: strike, entry (bid/ask mid), structural stop, targets, delta, plus moneyness and theta — for BOTH long and short. Toggle Long/Short to load each."],
  ["4","Size it off your risk","Type “Risk today $.” Contracts auto-size to what that budget buys, showing the cost and the max loss if stopped. You size off risk — never off “it’s cheap.”"],
  ["5","Read the 3 answers","Risk if wrong, Reward if right, and the Risk:Reward ratio calculate themselves — ✓ Go at 1:3+, ✗ Skip under 1:2. The stop is structural (from the invalidation level); delta shows your P&L per $1 the stock moves."],
  ["6","Plan the exit","Set your Scale-out plan — sell in pieces at T1/T2/Runner (it auto-fills the target prices and splits your contracts). Tap “Add these to my alerts,” then set the alert levels on your broker. After T1 fills, trail the runner to breakeven — now it's a free trade."],
  ["7","Confirm your reasons","Tick the checklist — FTFC, at a level, real trigger, trend-aligned (50 EMA/VWAP), volume confirms, no IV-crush event, stop defined. You want 3+. Multiple reasons or no trade."],
  ["8","Ask the coach","Tap “Examine with the coach” for a blunt GO / WAIT / SKIP, or open the per-trade chat to talk it through. It knows your rules, bias, leak, goals and the exact numbers on the card."],
  ["9","Take the trigger & record it","Execute ONLY on a real trigger, confirming the live premium on your chain. Fill in “Actual fill — what I placed” so you have the truth — real strike, buy, sell and P&L — to compare against the plan."],
  ["10","Journal & review","Log the trade in Journal (fastest from a screenshot), grade it, mark on/off-plan. The Dashboard tracks your equity curve, win % and P/L ratio; weekly, run the EOD + Weekly Scorecard to fix the one recurring mistake."],
];
const TICKET=[
  "Both-side callout — strike, trigger and targets — from a single scan",
  "Bid / ask, with entry auto-set to the mid; moneyness (ITM/OTM) and theta (time decay)",
  "Structural stop derived from the invalidation level (40–50% as the guardrail)",
  "Position sizing — your risk budget → how many contracts it buys + max loss",
  "The 3 answers: Risk, Reward, and Risk:Reward with the 1:3 go/skip gate",
  "Delta readout — your P&L for every $1 the stock moves, and points to target",
  "Scale-out plan — T1/T2/Runner, profit banked at each, one tap to alerts",
  "Exit plan & alerts — the levels to set on your broker/TradingView",
  "Actual fill — record what you really placed, and your true P&L vs the plan",
  "A per-trade coach chat that knows this exact setup",
];
const WALK=[
  {t:"Guide",w:"You're here — the map. It explains the daily loop, the trade ticket, the rules that run through everything, and this step-by-step tour of every tab.",l:"Points you into <b>every</b> other tab. Start here whenever you're unsure where something lives."},
  {t:"Today",w:"Your daily command center and first stop. It holds your profit <b>Goals</b> + account planner, overnight <b>Futures</b>, an auto-loading <b>Watchlist news</b> panel, one-tap coaching, the <b>Examine</b> trade calculator(s), your live stats, notes, and the top <b>Runners to watch</b>.",l:"Prices &amp; news come from your <b>Watchlist</b> tickers · the stats read from your <b>Journal</b> · Examine logs into the <b>Journal</b> · Goals track against the <b>Journal</b> · Runners-to-watch jumps to the <b>Runner</b> tab · the coach is the same brain as <b>Tutor</b>."},
  {t:"Dashboard",w:"Your scoreboard: equity curve, profit/loss ratio, win %, and the full trade table.",l:"Reads entirely from the <b>Journal</b> — every number here updates the moment you log a trade in <b>Journal</b>."},
  {t:"Journal",w:"The record everything else is built on. Log trades (fastest from a screenshot), grade A–F, mark on/off-plan, and see P&amp;L by setup.",l:"Feeds the <b>Dashboard</b>, <b>Review</b>, <b>Today</b> stats and <b>Goals</b> · the <b>Scans</b> journal matches your trades back to the scan that surfaced them."},
  {t:"Review",w:"The step-back view: all-time totals and weekly recaps of what you actually did.",l:"Summarizes your <b>Journal</b> over time — a companion to the live numbers on the <b>Dashboard</b>."},
  {t:"Watchlist",w:"Your 30+ tickers. Scan structural bias (with the ⏱ Auto option), open a live <b>chart</b> with your trigger/stop/target drawn, see intraday flow timing, the largest holders + news, a full 🔍 Deep Dive, and the scanner + Examine calculator on any name.",l:"Its tickers drive <b>Today</b> (quotes + news), <b>Strat</b>, <b>Runner</b>, <b>Scans</b>, <b>News</b> and <b>Sectors</b> · the chart it opens is the same one used elsewhere (with the 📉 P/L toggle) · Examine here logs to the <b>Journal</b>."},
  {t:"Strat",w:"The Daily/Weekly/Monthly/Quarterly continuity screener — flags Nirvana (1-3), Holy Grail (3-1) and full-continuity (FTFC) names, with a ? read on every ticker.",l:"Scans your <b>Watchlist</b> · tap a name into <b>Watchlist</b> to confirm on the chart · every pattern it names is defined in the <b>Playbook</b> and taught in the <b>Tutor</b> course."},
  {t:"Runner",w:"The 10-bagger hunter — grades your list on compression, level, catalyst and premium fuel, makes you run the 10x math, and now draws a 📉 <b>P/L curve</b> on each candidate contract.",l:"Uses your <b>Watchlist</b> tickers · 'Chart it' opens the shared chart · 'Run the 10x math' feeds the calculator · every scan auto-saves to <b>Scans</b> · the P/L curve is the same engine as the <b>P/L</b> tab."},
  {t:"Scans",w:"Your scan journal: every scan you run (Runner, Watchlist bias, goal &amp; account plays) is saved automatically, matched to the trades you took, and scored — so you learn which scanner actually pays. Includes Ask-the-coach.",l:"Collects from all the scanners in <b>Runner</b>, <b>Watchlist</b> and <b>Today</b> · matches against your <b>Journal</b> trades · the ⏱ Auto toggle controls whether Runner/Watchlist re-scan on open."},
  {t:"Sectors",w:"The rotation board — sector performance and charts, so you see where money is flowing.",l:"Tells you which of your <b>Watchlist</b> names are in a strong or weak group before you trade them."},
  {t:"Tools",w:"Your calculators + scanners: pivot points, expected-move (standard deviation) bands, auto-filled key levels, the 🎯 <b>Liquidity Sweep scanner</b> that flags which watchlist names just raided the stops and reversed (▲ reclaim / ▼ rejection), and a ticker finder.",l:"Key levels feed your read on the <b>Watchlist</b> chart · expected-move is the same idea as the band in the <b>P/L</b> tab · the sweep scanner is the '<b>Don't be the liquidity</b>' idea from the <b>Playbook</b>, run live on your list · the finder adds names to your <b>Watchlist</b>."},
  {t:"P/L",w:"The payoff lab — build any options position leg by leg (long call, spread, straddle, calendar, iron condor) and see its profit/loss curve, breakevens, max win/loss and the expected-move band.",l:"The same compact curve is embedded in <b>Runner</b> cards and the <b>chart</b> modal (📉 P/L) · use it to vet a contract before you take it and log it to the <b>Journal</b>."},
  {t:"News",w:"The wire, two ways: ⚡ a free Yahoo feed (instant, no AI) and 🧠 an AI wire tagged bull/bear — for your watchlist or the broad market — plus a 🔍 Deep Dive box.",l:"The free feed also auto-shows on <b>Today</b> · both use your <b>Watchlist</b> tickers · Deep Dive pairs with the research on the <b>Watchlist</b> tab."},
  {t:"Playbook",w:"Your reference: first steps, the three strategy questions, the options playbook, and the full <b>illustrated glossary</b> — every term shown with its own diagram.",l:"Defines everything the <b>Strat</b>, <b>Runner</b> and <b>Scans</b> tabs flag · the <b>Tutor</b> course teaches this glossary lesson by lesson."},
  {t:"Library",w:"Your study shelf: saved videos, playlists, charts, watchlists and tools (Finviz, Stock Market Watch) — plus anything you add and rename yourself.",l:"Your personal store beside the structured learning in the <b>Playbook</b> and <b>Tutor</b>."},
  {t:"Tutor",w:"The course + your coach. A 10-lesson course where each lesson (concepts shown with diagrams) is followed by its own graded test, with a progress tracker — plus train-the-coach and a tutor chat.",l:"Teaches the <b>Playbook</b> glossary · the coach it trains is the same one behind Examine on <b>Today</b> and Ask-the-coach in <b>Scans</b>/<b>Runner</b> · your test scores track your progress."},
];

const PLAN=[
  "Set a profit goal for any timeframe — daily to annual — and the rest scale automatically, with live progress from your journal",
  "🧮 Goal calculator — enter your target + reward:risk; it shows the risk per trade, and at each win rate the risk/avg-win it takes (plus the account size each needs at your risk %)",
  "🟡 Account-safety guardrail — set your max risk % per trade; it flags the account you'd need so one bad streak can't blow you up",
  "Build my account — enter your real balance and it maps the whole path: growth % needed, risk per trade, trades to the goal, and live plays your account can afford",
  "🎯 Set the goal & track it — a live mission with a countdown timer, a checklist of the required trades, and W/L logging that updates your progress",
];
const RESEARCH=[
  "Intraday flow timing — when call vs put activity tends to peak by hour, so you time entries into strength and exits into the afternoon",
  "Ticker intel — the largest institutional holders (13F) with their latest moves, plus the freshest news",
  "🔍 Deep dive — a full report: institutional flow + news + timing patterns + a thesis, ending in best entry/exit windows and the level that makes it wrong",
];
function Guide(){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div className="card" style={{padding:22}}>
        <div className="eyebrow" style={{marginBottom:6}}>Start here</div>
        <h2 className="disp" style={{margin:"0 0 10px",fontSize:24,fontWeight:800}}>How this works together</h2>
        <p style={{margin:0,fontSize:15,color:"var(--dim)",lineHeight:1.6}}>This is one connected system with a single job: get you to take only <b style={{color:"var(--bone)"}}>A+ setups, sized by risk, with a plan for every trade</b> — and to learn from every result. Your journal proved your edge isn’t prediction, it’s discipline. Everything here enforces that: probability over prophecy, defense before offense, the trigger over the guess.</p>
      </div>

      <div className="card" style={{padding:22}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div><div className="eyebrow" style={{marginBottom:4}}>The loop</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Your daily workflow</h3></div><Help text="The repeatable process, start to finish. Tap any step to expand it. Following it every trade — that consistency — is the edge."/></div>
        <p style={{margin:"8px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Every trade runs the same path. Tap a step to open it.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {LOOP.map(([n,t,d])=><StepRow key={n} n={n} title={t} detail={d}/>)}
        </div>
      </div>

      <div className="card" style={{padding:22}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div><div className="eyebrow" style={{marginBottom:4}}>One card, the whole trade</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>The trade ticket</h3></div><Help text="Everything the Examine calculator gives you from a single scan — plan to exit, on Today and on every Watchlist ticker."/></div>
        <p style={{margin:"8px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>The Examine calculator is the heart of the app. One scan, and it hands you:</p>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {TICKET.map((t,i)=>(
            <div key={i} style={{display:"flex",gap:9,fontSize:14,color:"var(--dim)",lineHeight:1.5}}><span style={{color:"var(--brass)",flexShrink:0}}>▸</span><span>{t}</span></div>
          ))}
        </div>
      </div>

      <div className="card" style={{padding:22}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div><div className="eyebrow" style={{marginBottom:4}}>Step by step</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Every tab, and how they link</h3></div><Help text="A walkthrough of all 16 tabs in the order they sit in the nav — what each one does and which other tabs it feeds or pulls from. Tap any tab to expand."/></div>
        <p style={{margin:"8px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Read top to bottom, or tap any tab. Each shows what it does and how it connects to the rest.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {WALK.map((x,i)=><WalkRow key={x.t} i={i+1} t={x.t} w={x.w} l={x.l}/>)}
        </div>
      </div>

      <div className="card" style={{padding:22}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div><div className="eyebrow" style={{marginBottom:4}}>Aim & grow</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Plan your account</h3></div><Help text="The goal system on Today: set a target, see exactly what it takes at your risk size, map it from your real balance, and track it live with a countdown."/></div>
        <p style={{margin:"8px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Turn “I want to make $X” into a concrete, sized, trackable plan:</p>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {PLAN.map((t,i)=>(<div key={i} style={{display:"flex",gap:9,fontSize:14,color:"var(--dim)",lineHeight:1.5}}><span style={{color:"var(--brass)",flexShrink:0}}>▸</span><span>{t}</span></div>))}
        </div>
      </div>

      <div className="card" style={{padding:22}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div><div className="eyebrow" style={{marginBottom:4}}>Know what you're trading</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Research any ticker</h3></div><Help text="In Watchlist (per ticker) and in News (type any symbol): who's really behind it, what the smart money's doing, and when the flow moves — ending in a thesis with entry/exit windows."/></div>
        <p style={{margin:"8px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Beyond the chart — the flow, the holders, and a full thesis:</p>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {RESEARCH.map((t,i)=>(<div key={i} style={{display:"flex",gap:9,fontSize:14,color:"var(--dim)",lineHeight:1.5}}><span style={{color:"var(--brass)",flexShrink:0}}>▸</span><span>{t}</span></div>))}
        </div>
        <div style={{marginTop:12,padding:"10px 12px",background:"rgba(111,168,220,0.06)",border:"1px solid var(--focus)",borderRadius:9,fontSize:13,color:"var(--dim)",lineHeight:1.55}}>ℹ️ The AI features (Deep Dive, scanners, coach, news) need a connection to run. On the hosted app they use your own Anthropic API key (a few cents per call); everything else — calculators, journal, goals, risk math — is always free and works offline-style with no key.</div>
      </div>

      <div className="card" style={{padding:22}}>
        <div className="eyebrow" style={{marginBottom:10}}>The rules that run through all of it</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,fontSize:14.5,color:"var(--dim)",lineHeight:1.55}}>
          <div>• <b style={{color:"var(--bone)"}}>Probability, not prophecy.</b> Scenarios with confirm/invalidate levels — never a guaranteed call.</div>
          <div>• <b style={{color:"var(--bone)"}}>Defense first.</b> Stop, size, and max loss before the target.</div>
          <div>• <b style={{color:"var(--bone)"}}>Trade the trigger, not the prediction.</b> No trigger, no trade.</div>
          <div>• <b style={{color:"var(--bone)"}}>Cut losers fast, scale winners into strength.</b> Never hold a long option to zero.</div>
          <div>• <b style={{color:"var(--bone)"}}>Respect IV, theta, and events.</b> Don’t buy rich premium into a crush.</div>
          <div>• <b style={{color:"var(--bone)"}}>Your edge is discipline.</b> Process over outcome, every single day.</div>
        </div>
      </div>

      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div><div className="eyebrow" style={{marginBottom:4}}>Reference &amp; learning</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Where to study</h3></div></div>
        <p style={{margin:"8px 0 0",fontSize:14,color:"var(--dim)",lineHeight:1.6}}>The full illustrated glossary — every term with a diagram — lives in the <b style={{color:"var(--brass)"}}>Playbook</b> tab. To learn it start to finish, go to the <b style={{color:"var(--brass)"}}>Tutor</b> tab: a 10-lesson course where each lesson is followed by its own test that grades you and tracks your progress.</p>
      </div>
    </div>
  );
}

function periodEnd(tf){
  const d=new Date(), y=d.getFullYear(), m=d.getMonth();
  if(tf==="daily") return new Date(y,m,d.getDate(),23,59,59);
  if(tf==="weekly"){ const du=(7-d.getDay())%7; return new Date(y,m,d.getDate()+du,23,59,59); }
  if(tf==="monthly") return new Date(y,m+1,0,23,59,59);
  if(tf==="quarterly"){ const q=Math.floor(m/3); return new Date(y,q*3+3,0,23,59,59); }
  if(tf==="semi") return new Date(y,(m<6?6:12),0,23,59,59);
  if(tf==="annual") return new Date(y,12,0,23,59,59);
  return new Date(y,m+1,0,23,59,59);
}
function _easter(y){ const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(y,mo-1,da); }
function _nthWd(y,mon,wd,n){ let d=new Date(y,mon,1),c=0; while(true){ if(d.getDay()===wd){ c++; if(c===n) return new Date(d); } d.setDate(d.getDate()+1); } }
function _lastWd(y,mon,wd){ let d=new Date(y,mon+1,0); while(d.getDay()!==wd) d.setDate(d.getDate()-1); return new Date(d); }
function _obs(d){ const wd=d.getDay(); if(wd===6) return new Date(d.getFullYear(),d.getMonth(),d.getDate()-1); if(wd===0) return new Date(d.getFullYear(),d.getMonth(),d.getDate()+1); return d; }
function marketHolidays(y){ const gf=_easter(y); const gfri=new Date(gf); gfri.setDate(gf.getDate()-2);
  return [ _obs(new Date(y,0,1)), _nthWd(y,0,1,3), _nthWd(y,1,1,3), gfri, _lastWd(y,4,1), _obs(new Date(y,5,19)), _obs(new Date(y,6,4)), _nthWd(y,8,1,1), _nthWd(y,10,4,4), _obs(new Date(y,11,25)) ].map(d=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`); }
function tradingDaysBetween(start,end){ const y0=start.getFullYear(),y1=end.getFullYear(); let h=[]; for(let y=y0;y<=y1;y++) h=h.concat(marketHolidays(y));
  let n=0; const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()), e=new Date(end.getFullYear(),end.getMonth(),end.getDate());
  while(d<=e){ const wd=d.getDay(); if(wd!==0&&wd!==6&&!h.includes(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) n++; d.setDate(d.getDate()+1); } return n; }
function tradingDaysLeft(tf){ return Math.max(1,tradingDaysBetween(new Date(),periodEnd(tf))); }
function fmtCountdown(ms){ if(ms<=0) return "time's up"; const s=Math.floor(ms/1000); const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),mi=Math.floor(s%3600/60),se=s%60; return `${d>0?d+"d ":""}${h}h ${mi}m ${se}s`; }
function playPlain(p){
  const short=/short|put|bear/i.test((p.dir||"")+(p.strike||""));
  const parts=[];
  parts.push(short
    ? `This is a SHORT — you think ${p.sym} goes DOWN, so you'd buy a PUT${p.strike?` (the ${p.strike})`:""}. A put gains value as the stock falls.`
    : `This is a LONG — you think ${p.sym} goes UP, so you'd buy a CALL${p.strike?` (the ${p.strike})`:""}. A call gains value as the stock rises.`);
  if(p.why) parts.push(`Why it's here: ${p.why}.`);
  const dv=parseFloat(String(p.delta||"").replace(/[^0-9.]/g,""));
  if(!isNaN(dv)) parts.push(`Delta ${p.delta} = the option moves about ${Math.round(dv*100)}¢ for every $1 the stock moves — near-the-money, so it tracks the move well.`);
  if(p.dte) parts.push(`${p.dte} = how many days until it expires. Short-dated, so it's for a quick move, not holding for weeks.`);
  if(p.risk) parts.push(`Risk ${p.risk} = the most you'd lose per contract if your stop gets hit.`);
  if(p.target) parts.push(`Target ${p.target} = your profit per contract if it works and price reaches the level. "(1:3)" means you risk 1 to make about 3.`);
  parts.push(`This is a candidate, not a signal — pull up the chart, wait for the actual trigger, then run it through Examine to size it.`);
  return parts.join(" ");
}
function PlayActions({p,short,setTrades}){
  const [mode,setMode]=useState("paper");
  const [added,setAdded]=useState(false);
  function take(){
    if(!setTrades) return;
    const strikeNum=(String(p.strike||"").match(/[\d.]+/)||[""])[0];
    const isPut=/put/i.test(p.strike||"")||short;
    const qty=String(p.contracts||"1").replace(/[^\d]/g,"")||"1";
    const tr={
      id:"play"+Date.now()+Math.random().toString(36).slice(2,5),
      date:todayISO(), ticker:(p.sym||"").toUpperCase(), instrument:"Option",
      direction: short?"Short":"Long", optType: isPut?"Put":"Call",
      strike: strikeNum, expiry:"", entry:"", exit:"", quantity:qty, multiplier:"",
      setup:"Other", timeframe:"", horizon:"Day", pnlManual:"",
      planFollowed:true, emotion:"On plan", paper: mode==="paper",
      notes:`${mode==="paper"?"[PAPER] ":"[REAL] "}${p.why||""}${p.trigger?` · wait for: ${p.trigger}`:""}${p.target?` · target ${p.target}`:""}${p.risk?` · risk ${p.risk}`:""} — auto-logged from a play. Fill entry/exit when done.`
    };
    setTrades(ts=>[tr,...ts]);
    setAdded(true); setTimeout(()=>setAdded(false),2400);
  }
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:9,flexWrap:"wrap"}}>
      <div style={{display:"flex",borderRadius:7,overflow:"hidden",border:"1px solid var(--line2)"}}>
        <button onClick={()=>setMode("paper")} className="mono" style={{padding:"5px 11px",fontSize:11.5,fontWeight:700,border:"none",cursor:"pointer",background:mode==="paper"?"var(--focus)":"transparent",color:mode==="paper"?"#0F141A":"var(--dim)"}}>📝 Paper</button>
        <button onClick={()=>setMode("real")} className="mono" style={{padding:"5px 11px",fontSize:11.5,fontWeight:700,border:"none",cursor:"pointer",background:mode==="real"?"var(--bull)":"transparent",color:mode==="real"?"#0F141A":"var(--dim)"}}>💵 Real</button>
      </div>
      <button onClick={take} disabled={added} className="mono" style={{padding:"6px 13px",fontSize:12,fontWeight:800,borderRadius:7,border:"none",cursor:added?"default":"pointer",background:added?"var(--bg3)":"var(--brass)",color:added?"var(--bull)":"#241A0A"}}>{added?"✓ Added to journal":`Take ${mode} trade →`}</button>
    </div>
  );
}
function Goals({trades,setTrades,watch}){
  const DAYS=[["daily","Daily",1],["weekly","Weekly",5],["monthly","Monthly",21],["quarterly","Quarterly",63],["semi","Semi-annual",126],["annual","Annual",252]];
  const dmap=Object.fromEntries(DAYS.map(d=>[d[0],d[2]]));
  const [anchor,setAnchor]=useState("monthly"); const [amt,setAmt]=useState("");
  const [msgs,setMsgs]=useState([]); const [cin,setCin]=useState(""); const [busy,setBusy]=useState(false); const [open,setOpen]=useState(false);
  const [calcOpen,setCalcOpen]=useState(false); const [showDaily,setShowDaily]=useState(false); const [goalName,setGoalName]=useState(""); const [tAmt,setTAmt]=useState(""); const [tTf,setTTf]=useState("monthly"); const [wr,setWr]=useState(""); const [aw,setAw]=useState(""); const [al,setAl]=useState("");
  const [ccMsgs,setCcMsgs]=useState([]); const [ccIn,setCcIn]=useState(""); const [ccBusy,setCcBusy]=useState(false);
  const [tpd,setTpd]=useState("6"); const [rr,setRr]=useState("3"); const [riskPct,setRiskPct]=useState("4");
  const [missions,setMissions]=useState([]); const [activeId,setActiveId]=useState(null); const [linkSel,setLinkSel]=useState("new"); const [nowTs,setNowTs]=useState(Date.now());
  const mission=missions.find(m=>m.id===activeId)||null;
  const [plays,setPlays]=useState(null); const [pLoad,setPLoad]=useState(false); const [pErr,setPErr]=useState(""); const [pTime,setPTime]=useState(null);
  const cool=useCoolLeft();
  const [acctBal,setAcctBal]=useState(""); const [growPct,setGrowPct]=useState(""); const [growTf,setGrowTf]=useState("monthly"); const [aPlays,setAPlays]=useState(null); const [aLoad,setALoad]=useState(false); const [aErr,setAErr]=useState(""); const [aTime,setATime]=useState(null);
  const [dayPlays,setDayPlays]=useState(null); const [dayLoad,setDayLoad]=useState(false); const [dayErr,setDayErr]=useState("");
  useEffect(()=>{ (async()=>{ try{
    let arr=await sGet("goals:missions");
    if(!Array.isArray(arr)){ const legacy=await sGet("goals:mission"); arr=(legacy&&Array.isArray(legacy.logs))?[{...legacy,id:legacy.id||("g"+Date.now()),name:legacy.name||"Goal #1"}]:[]; }
    setMissions(arr); const act=await sGet("goals:activeMission"); setActiveId(act||(arr[0]?arr[0].id:null));
  }catch(e){} })(); },[]);
  useEffect(()=>{ sSet("goals:missions",missions); },[missions]);
  useEffect(()=>{ if(activeId!=null) sSet("goals:activeMission",activeId); },[activeId]);
  useEffect(()=>{ const i=setInterval(()=>setNowTs(Date.now()),1000); return ()=>clearInterval(i); },[]);
  useEffect(()=>{ (async()=>{ try{ const a=await sGet("goals:anchor"); const m=await sGet("goals:amt"); if(a)setAnchor(a); if(m!=null&&m!=="")setAmt(String(m)); }catch(e){} })(); },[]);
  useEffect(()=>{ sSet("goals:anchor",anchor); },[anchor]);
  useEffect(()=>{ sSet("goals:amt",amt); },[amt]);
  const perDay=(num(amt)!=null&&dmap[anchor])?num(amt)/dmap[anchor]:null;
  const goalFor=(k)=> perDay!=null?perDay*dmap[k]:null;
  const closed=trades.map(t=>({...t,pnl:computePnl(t)})).filter(t=>t.pnl!=null);
  const sow=startOfWeek(); const now=new Date();
  const wkP=closed.filter(t=>new Date(t.date)>=sow).reduce((a,t)=>a+t.pnl,0);
  const moP=closed.filter(t=>{const d=new Date(t.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce((a,t)=>a+t.pnl,0);
  const gwins=closed.filter(t=>t.pnl>0), glosses=closed.filter(t=>t.pnl<0);
  const winRateA=closed.length?Math.round(gwins.length/closed.length*100):0;
  const avgWinA=gwins.length?gwins.reduce((a,t)=>a+t.pnl,0)/gwins.length:0;
  const avgLossA=glosses.length?Math.abs(glosses.reduce((a,t)=>a+t.pnl,0)/glosses.length):0;
  const tAmtE=tAmt!==""?num(tAmt):goalFor(tTf);
  const daysT=tradingDaysLeft(tTf);
  const rrN=num(rr)||3;
  const tpdN=num(tpd)||6;
  const totalTrades=Math.max(1,Math.round(tpdN));
  const perDayInfo=daysT?totalTrades/daysT:null;
  const profitPerTrade=(tAmtE!=null&&totalTrades)?tAmtE/totalTrades:null;
  const beWr=rrN>0?100/(1+rrN):null;
  const WRS=[40,50,60,70];
  const scen=(profitPerTrade!=null&&profitPerTrade>0)?WRS.map(w=>{ const f=w/100; const eR=f*rrN-(1-f); const risk=eR>0?profitPerTrade/eR:null; const avgWin=risk!=null?risk*rrN:null; const wins=Math.round(f*totalTrades); const losses=totalTrades-wins; return {w,eR,risk,avgWin,wins,losses}; }):[];
  useEffect(()=>{ setTTf(anchor); },[anchor]);
  useEffect(()=>{ const g=goalFor(tTf); setTAmt(g!=null?String(Math.round(g)):""); },[amt,anchor,tTf]);
  function setGoalMission(){
    if(tAmtE==null||!totalTrades||tAmtE<=0) return;
    const n=Math.min(totalTrades,200);
    const logs=Array.from({length:n},()=>({done:false,actual:""}));
    if(linkSel&&linkSel!=="new"){ // update an existing goal with this target
      setMissions(ms=>ms.map(mm=>mm.id!==linkSel?mm:{...mm,target:tAmtE,tf:tTf,perTrade:profitPerTrade,deadline:periodEnd(tTf).toISOString(),logs}));
      setActiveId(linkSel); setCalcOpen(false); return;
    }
    const id="g"+Date.now(); const nextNum=missions.length+1;
    const m={id,name:(goalName.trim()||("Goal #"+nextNum)),target:tAmtE,tf:tTf,perTrade:profitPerTrade,deadline:periodEnd(tTf).toISOString(),logs};
    setMissions(ms=>[...ms,m]); setActiveId(id); setLinkSel("new"); setGoalName(""); setCalcOpen(false);
  }
  function updLog(i,patch){ setMissions(ms=>ms.map(mm=>mm.id!==activeId?mm:{...mm,logs:mm.logs.map((l,j)=>j===i?{...l,...patch}:l)})); }
  function resetMission(){ setMissions(ms=>{ const rest=ms.filter(m=>m.id!==activeId); setActiveId(rest[0]?rest[0].id:null); return rest; }); }
  function renameMission(nm){ setMissions(ms=>ms.map(mm=>mm.id!==activeId?mm:{...mm,name:nm})); }
  const mTotal=mission?mission.logs.reduce((a,l)=>a+(num(l.actual)||0),0):0;
  const mDone=mission?mission.logs.filter(l=>l.done).length:0;
  const mWins=mission?mission.logs.filter(l=>num(l.actual)>0).length:0;
  const mLosses=mission?mission.logs.filter(l=>num(l.actual)<0).length:0;
  const mPct=(mission&&mission.target)?Math.max(0,Math.min(100,mTotal/mission.target*100)):0;
  const mRemain=mission?mission.target-mTotal:0;
  const msLeft=mission?new Date(mission.deadline).getTime()-nowTs:0;
  const jRef=mission?(mission.tf==="weekly"?wkP:mission.tf==="monthly"?moP:null):null;
  const PNOUN=({daily:"day",weekly:"week",monthly:"month",quarterly:"quarter",semi:"half-year",annual:"year"})[tTf]||tTf;
  const acctB=num(acctBal);
  const growN=num(growPct);
  const growTarget=(acctB!=null&&acctB>0&&growN!=null&&growN>0)?acctB*growN/100:null;
  useEffect(()=>{ if(growTarget!=null){ setAnchor(growTf); setAmt(String(Math.round(growTarget))); } },[growTarget,growTf]);
  const rpct=(num(riskPct)||4)/100;
  const acctRisk=(acctB!=null)?acctB*rpct:null;
  const acctWin=(acctRisk!=null)?acctRisk*rrN:null;
  const growthPct=(acctB!=null&&acctB>0&&tAmtE!=null)?tAmtE/acctB*100:null;
  const acctScen=(acctRisk!=null&&acctWin!=null&&tAmtE!=null&&tAmtE>0)?WRS.map(w=>{ const f=w/100; const exp=f*acctWin-(1-f)*acctRisk; const trades=exp>0?Math.ceil(tAmtE/exp):null; const g=(acctB>0)?exp/acctB:0; const tradesC=(g>0)?Math.ceil(Math.log((acctB+tAmtE)/acctB)/Math.log(1+g)):null; const perDay=(trades!=null&&daysT)?trades/daysT:null; return {w,exp,trades,tradesC,perDay}; }):[];
  async function scanDayTrades(nPerDay,perTradeAmt){
    if(dayLoad) return; setDayLoad(true); setDayErr("");
    try{
      const syms=(watch||[]).slice(0,24);
      if(!syms.length){ setDayErr("Add tickers to your watchlist first."); setDayLoad(false); return; }
      const riskLine=acctRisk!=null?` I risk ~${fmtMoney(acctRisk)} per trade.`:"";
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — Find TODAY'S best trades to stay on my goal pace. I need about ${nPerDay} trade${nPerDay>1?"s":""} today, each aiming for ~${fmtMoney(perTradeAmt)} profit at 1:${rrN}.${riskLine} Scan my watchlist for CURRENT setups (Strat continuity/patterns, at or approaching a level, real trigger potential) that are actionable TODAY. Return ONLY a JSON array, no prose or fences: [{"sym":"IWM","dir":"Short","why":"the setup in <=16 words","strike":"289 Put","delta":"~0.58","dte":"3-5 DTE","trigger":"the exact break/level to WAIT for","risk":"~$ to the stop","target":"~$ if 1:${rrN} hits"}]. Return the 3 best only, TIGHT short fields so the full JSON fits. The latest candle may be forming (pending). Estimates only — I confirm on chart/chain and wait for the trigger.`);
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Best trades to take TODAY (${todayISO()}) from my watchlist: ${syms.join(", ")}. I need ~${nPerDay} trade(s) at ~${fmtMoney(perTradeAmt)} each.`}] });
      let j=extractJson(getText(res)); if(!Array.isArray(j)||!j.length) j=extractObjs(getText(res));
      if(Array.isArray(j)&&j.length){ setDayPlays(j.filter(p=>p&&p.sym)); } else setDayErr("Couldn't find today's trades — try again.");
    }catch(e){ setDayErr(aiErr(e,"Scan")); }
    setDayLoad(false);
  }
  async function findAcctPlays(){
    if(aLoad) return; setALoad(true); setAErr("");
    try{
      const syms=(watch||[]).slice(0,24);
      if(!syms.length){ setAErr("Add tickers to your watchlist first."); setALoad(false); return; }
      if(acctB==null||acctRisk==null){ setAErr("Enter your account balance first."); setALoad(false); return; }
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — Find PLAYS sized to MY ACCOUNT. Account: ${fmtMoney(acctB)}. I risk ${num(riskPct)||4}% = ~${fmtMoney(acctRisk)} per trade, targeting 1:${rrN} (~${fmtMoney(acctWin)} per winner).${tAmtE!=null?` Goal: ${fmtMoney(tAmtE)} over the ${PNOUN}.`:""} Scan my watchlist for CURRENT setups (Strat continuity/patterns, at a level, real trigger potential) I can actually AFFORD and that risk about ${fmtMoney(acctRisk)} to the stop — pick strikes whose per-contract risk and cost fit this account, and say how many contracts. Search current structure; latest candle may be forming (pending). Return ONLY a JSON array, no prose/fences: [{"sym":"IWM","dir":"Short","why":"the setup in ≤16 words","strike":"289 Put","contracts":"e.g. 1-2","delta":"~0.58","dte":"3–5 DTE","risk":"~$ total to the stop (fits ${fmtMoney(acctRisk)})","target":"~$ if 1:${rrN} hits"}]. Keep it TIGHT: return the 3 best only, short fields, so the full JSON fits. Estimates — I confirm on chart/chain.`);
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Find plays my ${fmtMoney(acctB)} account can afford, risking ~${fmtMoney(acctRisk)} each. Watchlist: ${syms.join(", ")}. Today ${todayISO()}.`}] });
      let j=extractJson(getText(res)); if(!Array.isArray(j)||!j.length) j=extractObjs(getText(res));
      if(Array.isArray(j)&&j.length){ const ap=j.filter(p=>p&&p.sym); setAPlays(ap); setATime(Date.now()); logScan("Account plays", ap.map(p=>p.sym), ap.map(p=>({s:p.sym,note:String(p.dir?p.dir+" · ":"").concat(String(p.why||"")).slice(0,60)}))); } else setAErr("Couldn't find plays — try again.");
    }catch(e){ setAErr(aiErr(e,"Scan")); }
    setALoad(false);
  }
  async function findPlays(){
    if(pLoad) return; setPLoad(true); setPErr("");
    try{
      const syms=(watch||[]).slice(0,24);
      if(!syms.length){ setPErr("Add tickers to your watchlist first."); setPLoad(false); return; }
      if(tAmtE==null||!profitPerTrade){ setPErr("Set a target first."); setPLoad(false); return; }
      const r50=scen.find(s=>s.w===50);
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — Find PLAYS to hit my profit goal. Goal: ${fmtMoney(tAmtE)} over the ${PNOUN}. Plan: about ${totalTrades} quality trades total, needing ~${fmtMoney(profitPerTrade)} average profit per trade at 1:${rrN}. Reference (50% win rate): risk ~${r50&&r50.risk!=null?fmtMoney(r50.risk):"?"} to make ~${r50&&r50.avgWin!=null?fmtMoney(r50.avgWin):"?"} per trade. Scan my watchlist for CURRENT setups (Strat continuity/patterns, at a level, real trigger potential) that can realistically deliver about 1:${rrN} at roughly that size, and give the exact contract to trade each. Search current structure; the latest candle may be forming (pending). Return ONLY a JSON array, no prose/fences: [{"sym":"IWM","dir":"Short","why":"the setup in ≤16 words","strike":"289 Put","delta":"~0.58","dte":"3–5 DTE","risk":"~$ per contract to the stop","target":"~$ if 1:${rrN} hits"}]. Keep it TIGHT: return the 3 best only, short fields, so the full JSON fits. Estimates — I confirm on chart/chain.`);
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Find 3–6 plays on my watchlist that fit this goal. Watchlist: ${syms.join(", ")}. Today is ${todayISO()}.`}] });
      let j=extractJson(getText(res)); if(!Array.isArray(j)||!j.length) j=extractObjs(getText(res));
      if(Array.isArray(j)&&j.length){ const pp=j.filter(p=>p&&p.sym); setPlays(pp); setPTime(Date.now()); logScan("Goal plays", pp.map(p=>p.sym), pp.map(p=>({s:p.sym,note:String(p.dir?p.dir+" · ":"").concat(String(p.why||"")).slice(0,60)}))); } else setPErr("Couldn't find plays — try again.");
    }catch(e){ setPErr(aiErr(e,"Scan")); }
    setPLoad(false);
  }
  const fld={fontFamily:"inherit",background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--bone)",borderRadius:8,padding:"9px 11px",fontSize:14.5,outline:"none"};
  async function sendCalc(){
    const q=ccIn.trim(); if(!q||ccBusy) return;
    const hist=[...ccMsgs,{role:"user",content:q}]; setCcMsgs(hist); setCcIn(""); setCcBusy(true);
    try{
      const ctx=`Goal-calculator scenario: target ${tAmtE!=null?fmtMoney(tAmtE):"?"} over ${tTf} at ${tpdN} trades/day = ~${totalTrades} trades, needing ${profitPerTrade!=null?fmtMoney(profitPerTrade):"?"} avg profit/trade. At 1:${rrN} the required risk & avg win by win rate: ${scen.filter(s=>s.risk!=null).map(s=>`${s.w}%→risk ${fmtMoney(s.risk)}, win ${fmtMoney(s.avgWin)}`).join("; ")||"n/a"}. Break-even win rate ${beWr!=null?Math.round(beWr)+"%":"?"}.`;
      const sys=await withKB(MENTOR_SYS+`\n\nYou're helping me use my GOAL CALCULATOR. ${ctx}\nCoach me on this math — is the goal realistic, and what specifically to change to improve my expectancy (bigger winners by letting runners go / scaling less early, cutting held-to-zero losers, taking only A+ setups) and the PROCESS to get there. Never encourage forcing volume or oversizing. Concise and honest. Today is ${todayISO()}.`);
      const res=await callClaude({ maxTokens:700, system:sys, messages:hist.map(m=>({role:m.role,content:m.content})) });
      setCcMsgs([...hist,{role:"assistant",content:getText(res)||"(no response)"}]);
    }catch(e){ setCcMsgs([...hist,{role:"assistant",content:"("+aiErr(e,"Reply")+")"}]); }
    setCcBusy(false);
  }
  async function send(){
    const q=cin.trim(); if(!q||busy) return;
    const hist=[...msgs,{role:"user",content:q}]; setMsgs(hist); setCin(""); setBusy(true);
    try{
      const goalsCtx=perDay!=null?DAYS.map(d=>`${d[1]} ${fmtMoney(perDay*d[2])}`).join(", "):"not set yet";
      const sys=await withKB(MENTOR_SYS+`\n\nYou're helping me set and hit realistic PROFIT GOALS. Current goals: ${goalsCtx}. This week actual: ${fmtMoney(wkP)}; this month actual: ${fmtMoney(moP)}. Coach me on whether the goals are realistic for my account, win rate and edge, how many quality setups that implies, and the PROCESS to get there — never P&L-chasing. Remind me: measure by process followed not daily P&L; get-rich-quick makes me oversize and hold losers. Concise and honest. Today is ${todayISO()}.`);
      const res=await callClaude({ maxTokens:700, system:sys, messages:hist.map(m=>({role:m.role,content:m.content})) });
      setMsgs([...hist,{role:"assistant",content:getText(res)||"(no response)"}]);
    }catch(e){ setMsgs([...hist,{role:"assistant",content:"("+aiErr(e,"Reply")+")"}]); }
    setBusy(false);
  }
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <div><div className="eyebrow" style={{marginBottom:4}}>Aim</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Profit goals</h3></div>
        <Help text="Set a profit target for any one timeframe and the rest scale automatically (≈252 trading days a year: 5/week, 21/month, 63/quarter, 126/half). Weekly and monthly show your real progress from the journal. Goals are a compass, not a whip — aim at your PROCESS and the P&L follows. Talk it through in the chat below."/>
        <div style={{flex:1}}/>
        <button onClick={()=>setCalcOpen(o=>!o)} className="mono" style={{border:"1px solid var(--line2)",background:calcOpen?"var(--bg3)":"transparent",color:"var(--focus)",cursor:"pointer",fontSize:13,fontWeight:700,borderRadius:8,padding:"6px 10px"}}>🧮 Goal calculator {calcOpen?"▾":"▸"}</button>
      </div>
      <p style={{margin:"8px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Set one, the rest scale. Aim at the process, not the number.</p>

      {calcOpen &&
        <div style={{marginBottom:16,padding:"14px 15px",background:"var(--bg)",border:"1px solid var(--brass-dim)",borderRadius:12}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}><div className="eyebrow" style={{margin:0}}>Goal calculator — how to reach it</div><Help align="left" text="Works backward from a target: given your win rate and average win/loss, it computes your EXPECTANCY per trade (win% × avg win − loss% × avg loss), then how many trades that target takes and roughly how many per day. If your expectancy is negative, no amount of trading gets there — it tells you the avg win or win rate you'd need to flip positive. Defaults pull from your real journal; edit any field to test a scenario."/></div>
          <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><span className="mono" style={{fontSize:11.5,color:"var(--brass)"}}>Target $</span><Help align="left" text="The profit you're aiming for. Auto-fills from the goal you set above — type over it to test any number."/></div><input value={tAmt} onChange={e=>setTAmt(e.target.value)} className="mono" placeholder={goalFor(tTf)!=null?Math.round(goalFor(tTf)).toString():"2000"} style={{...fld,width:"100%",padding:"8px 9px",fontWeight:700,color:"var(--brass)"}}/></div>
            <div><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>Over</span><Help align="left" text="The timeframe for the target. The calculator uses its trading days — day 1, week 5, month 21, quarter 63, half-year 126, year 252 — to work out your pace."/></div><select value={tTf} onChange={e=>setTTf(e.target.value)} className="mono" style={{...fld,width:"100%",padding:"8px 9px",cursor:"pointer"}}>{DAYS.map(d=><option key={d[0]} value={d[0]}>{d[1]}</option>)}</select></div>
          </div>
          <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:6}}>Add your pace — it computes the rest:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>How many trades</span><Help align="left" text="How many trades you'll take over the whole period — total, not per day. This sets how much each trade must average. The line below shows what you'd risk per trade at a 50% win rate."/></div><input value={tpd} onChange={e=>setTpd(e.target.value)} className="mono" placeholder="6" style={{...fld,width:"100%",padding:"8px 9px"}}/>
              {(()=>{ const r50=scen.find(s=>s.w===50); return (r50&&r50.risk!=null)?<div className="mono" style={{fontSize:11,color:"var(--brass)",marginTop:4,lineHeight:1.4}}>At 50% win rate: risk ~{fmtMoney(r50.risk)}/trade · {r50.wins}W · {r50.losses}L</div>:null; })()}
            </div>
            <div><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>Reward : risk</span><Help align="left" text="Your target payoff ratio. 1:3 means you aim to make 3× what you risk — your rule. Higher RR means a smaller win rate is needed and fewer trades to the goal."/></div><input value={rr} onChange={e=>setRr(e.target.value)} className="mono" placeholder="3" style={{...fld,width:"100%",padding:"8px 9px"}}/></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,padding:"8px 11px",background:"var(--bg3)",border:"1px solid var(--line)",borderRadius:9}}>
            <span style={{fontSize:13.5}}>📅</span>
            <span className="mono" style={{fontSize:13,color:"var(--bone)"}}><b style={{color:"var(--brass)"}}>{daysT}</b> trading day{daysT===1?"":"s"} left in this {({daily:"day",weekly:"week",monthly:"month",quarterly:"quarter",semi:"half-year",annual:"year"})[tTf]}</span>
            <Help align="left" text="Counted from a real calendar: weekdays from today through the end of the selected period, minus weekends and the ~10 NYSE market holidays (New Year's, MLK, Presidents', Good Friday, Memorial, Juneteenth, July 4, Labor Day, Thanksgiving, Christmas). It's days LEFT, not the full period — so it shrinks as the month goes on."/>
          </div>
          {profitPerTrade!=null && profitPerTrade>0 &&
            <div style={{padding:"12px 13px",background:"var(--bg3)",border:"1px solid var(--brass-dim)",borderRadius:10}}>
              <div style={{fontSize:14,color:"var(--bone)",lineHeight:1.6,marginBottom:10}}>
                Across <b style={{color:"var(--brass)"}}>{totalTrades} trades</b> this {({daily:"day",weekly:"week",monthly:"month",quarterly:"quarter",semi:"half-year",annual:"year"})[tTf]}{perDayInfo!=null&&perDayInfo<1?` (about ${(1/perDayInfo).toFixed(0)} days apart)`:perDayInfo!=null?` (~${perDayInfo.toFixed(1)}/day)`:""} at <b style={{color:"var(--bone)"}}>1:{rrN}</b><Help align="left" text={`1:${rrN} is reward-to-risk — you risk 1 to try to make ${rrN}. Risk $100 to aim for $${rrN*100}. It's the ratio that lets you profit even losing most trades: the break-even win rate here is just ${beWr!=null?Math.round(beWr)+"%":"25%"}, because your winners are ${rrN}× your losers.`}/> → you need <b style={{color:"var(--bull)"}}>{fmtMoney(profitPerTrade)}</b> average profit per trade. Break-even win rate: <b>{beWr!=null?Math.round(beWr)+"%":"—"}</b>.
              </div>
              <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:2,marginBottom:10,lineHeight:1.5}}>This is a flat per-trade target (same size each trade). To see how <b style={{color:"var(--bull)"}}>compounding</b> — growing your size as the account grows — cuts the trades needed, enter your balance in <b style={{color:"var(--bone)"}}>Build my account</b> below.</div>
              <div className="eyebrow" style={{marginBottom:7}}>What each win rate requires</div>
              <div style={{display:"flex",flexDirection:"column"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"var(--faint)",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.06em",paddingBottom:5,borderBottom:"1px solid var(--line)"}}>
                  <span style={{width:78,display:"flex",alignItems:"center",gap:3}}>Win % · W/L<Help align="left" text={`The share you'd win, and the wins-vs-losses split out of your ${totalTrades} trades. The losers are counted — at 50% that's half winners, half losers, and the math already subtracts the losers.`}/></span>
                  <span style={{flex:1,display:"flex",alignItems:"center",gap:3}}>Risk / trade (avg loss)<Help align="left" text="How much you'd risk (and lose on a loser) per trade to hit the goal at that win rate. This is your position size off the stop."/></span>
                  <span style={{flex:1,display:"flex",alignItems:"center",gap:3}}>Avg win<Help align="left" text="The average winner you'd need — it's the risk × your reward:risk. At 1:3, risk $24 means each win must average ~$72. 1:3 = you risk 1 to make 3, the ratio that lets you profit even winning under half your trades."/></span>
                </div>
                {scen.map(s=>(
                  <div key={s.w} style={{display:"flex",alignItems:"center",gap:8,fontSize:14,padding:"7px 0",borderBottom:"1px solid var(--line)"}}>
                    <span style={{width:78,display:"flex",flexDirection:"column",lineHeight:1.2}}>
                      <span className="mono" style={{fontWeight:800,color:"var(--bone)"}}>{s.w}%</span>
                      <span className="mono" style={{fontSize:11.5}}><span style={{color:"var(--bull)"}}>{s.wins}W</span> <span style={{color:"var(--faint)"}}>·</span> <span style={{color:"var(--bear)"}}>{s.losses}L</span></span>
                    </span>
                    <span style={{flex:1,display:"flex",flexDirection:"column",lineHeight:1.2}}>
                      <span className="mono" style={{color:s.risk!=null?"var(--bear)":"var(--faint)",fontWeight:700}}>{s.risk!=null?fmtMoney(s.risk):"—"}</span>
                      {s.risk!=null && <span className="mono" style={{fontSize:11.5,color:"var(--brass)"}}>acct ~{fmtMoney(s.risk/((num(riskPct)||4)/100))} @ {num(riskPct)||4}%</span>}
                    </span>
                    <span className="mono" style={{color:s.avgWin!=null?"var(--bull)":"var(--faint)",flex:1,fontWeight:700}}>{s.avgWin!=null?fmtMoney(s.avgWin):"—"}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:10,padding:"11px 13px",background:"rgba(227,168,87,0.09)",border:"1px solid var(--brass)",borderRadius:10}}>
                <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:6}}>
                  <span style={{fontSize:14.5}}>🟡</span>
                  <span className="mono" style={{fontSize:13,color:"var(--brass)",fontWeight:800}}>Don't blow your account — risk</span>
                  <input value={riskPct} onChange={e=>setRiskPct(e.target.value)} className="mono" style={{width:44,background:"var(--bg)",border:"1px solid var(--brass)",color:"var(--brass)",borderRadius:6,padding:"3px 6px",fontSize:13.5,fontWeight:800,textAlign:"center",outline:"none"}}/>
                  <span className="mono" style={{fontSize:13,color:"var(--brass)",fontWeight:800}}>% per trade max</span>
                  <Help align="left" text="Position-sizing rule: never risk more than a small % of your account on one trade. 1–2% is conservative, 4–5% is aggressive. The 'acct ~$X' beside each row is the account you'd need so that trade's risk stays at this %. Trade with a smaller account and you're risking a bigger slice — a few losers in a row can wipe you out."/>
                </div>
                <div className="mono" style={{fontSize:11.5,color:"var(--dim)",lineHeight:1.5}}>The <b style={{color:"var(--brass)"}}>acct ~$</b> under each risk figure is the minimum account to keep that trade at {num(riskPct)||4}%. You risk <b style={{color:"var(--bear)"}}>{num(riskPct)||4}%</b> (the $ shown) per trade — no more. Less account than that = over-risking.</div>
              </div>
              <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:8,lineHeight:1.5}}>The W/L split shows the losers are already counted — your winners have to cover the losers AND still net the goal. A higher win rate or RR lowers the risk and avg-win each trade needs.</div>
              <button className="btn" style={{width:"100%",marginTop:12,opacity:(pLoad||cool>0)?0.5:1,cursor:(pLoad||cool>0)?"not-allowed":"pointer"}} onClick={findPlays} disabled={pLoad||cool>0}>{pLoad?<span className="spin"/>:cool>0?`⏳ Cooling down — ${cool}s`:"🔍 Find plays for this goal"}</button>
              <AiErrLine msg={pErr}/>
              {plays &&
                <div style={{marginTop:12}}>
                  <div className="eyebrow" style={{marginBottom:8}}>Plays that fit this goal</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {plays.map((p,i)=>{ const short=/short|put|bear/i.test((p.dir||"")+(p.strike||"")); return (
                      <div key={i} style={{padding:"11px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:5}}>
                          <span className="mono" style={{fontSize:14.5,fontWeight:800,color:"var(--focus)"}}>{p.sym}</span>
                          <Help align="left" text={playPlain(p)}/>
                          <span className="mono" style={{fontSize:11,fontWeight:800,letterSpacing:"0.05em",padding:"2px 7px",borderRadius:5,border:"1px solid "+(short?"var(--bear)":"var(--bull)"),color:short?"var(--bear)":"var(--bull)"}}>{short?"SHORT":"LONG"}</span>
                          {p.strike && <span className="mono" style={{fontSize:12.5,fontWeight:800,color:"var(--brass)",padding:"2px 8px",borderRadius:5,background:"var(--bg3)",border:"1px solid var(--brass-dim)"}}>{p.strike}</span>}
                        </div>
                        {p.why && <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.5,marginBottom:6}}>{p.why}</div>}
                        <div className="mono" style={{fontSize:12,color:"var(--faint)",display:"flex",gap:12,flexWrap:"wrap"}}>
                          {p.delta && <span>Δ {p.delta}</span>}
                          {p.dte && <span>{p.dte}</span>}
                          {p.risk && <span style={{color:"var(--bear)"}}>risk {p.risk}</span>}
                          {p.target && <span style={{color:"var(--bull)"}}>target {p.target}</span>}
                        </div>
                        <PlayActions p={p} short={short} setTrades={setTrades}/>
                      </div>
                    );})}
                  </div>
                  <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:8,lineHeight:1.5}}>Estimates{pTime?` · ${new Date(pTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:""} — confirm each on your chart and chain, then run it through Examine. Take only real triggers; this is a shortlist, not a signal.</div>
                </div>}
              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span className="mono" style={{fontSize:13,color:"var(--dim)"}}>Name it</span>
                <input value={goalName} onChange={e=>setGoalName(e.target.value)} placeholder="e.g. $1k month · account build" className="mono" style={{...fld,flex:1,minWidth:140,padding:"8px 10px",color:"var(--brass)"}}/>
              </div>
              <button className="btn-primary btn" style={{width:"100%",marginTop:8}} onClick={setGoalMission}>🎯 Set{goalName.trim()?` "${goalName.trim()}"`:" this goal"} & track it →</button>
              <div className="mono" style={{fontSize:11,color:"var(--faint)",marginTop:6,textAlign:"center"}}>Name it and it shows up in Build my account's "Link to" dropdown.</div>
            </div>}
          <div style={{marginTop:12,borderTop:"1px solid var(--line)",paddingTop:11}}>
            <div className="mono" style={{fontSize:12,color:"var(--focus)",fontWeight:700,marginBottom:8}}>💬 Chat about this scenario</div>
            {ccMsgs.length>0 && <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10,maxHeight:260,overflowY:"auto"}}>
              {ccMsgs.map((m,i)=><div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"88%",padding:"9px 12px",borderRadius:11,fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap",background:m.role==="user"?"var(--brass-dim)":"var(--bg2)",color:m.role==="user"?"#241A0A":"var(--bone)",border:m.role==="user"?"none":"1px solid var(--line)"}}>{m.content}</div>)}
              {ccBusy && <div style={{alignSelf:"flex-start",padding:"9px 12px"}}><span className="spin"/></div>}
            </div>}
            <div style={{display:"flex",gap:8}}>
              <input value={ccIn} onChange={e=>setCcIn(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendCalc();}} placeholder="How do I improve my expectancy?" style={{...fld,flex:1,padding:"9px 11px",fontSize:14}}/>
              <button className="btn-primary btn" onClick={sendCalc} disabled={ccBusy||!ccIn.trim()}>Send</button>
            </div>
          </div>
        </div>}

      <div className="card" style={{padding:20,marginBottom:16,border:"1px solid var(--brass-dim)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <div><div className="eyebrow" style={{marginBottom:4}}>From where you are</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Build my account</h3></div>
          <Help align="left" text="Enter your real balance and it maps the path from here to your goal: the growth % you're after, what you'd risk per trade at your account-risk %, how many trades it takes at each win rate, and live plays your account can actually afford. Uses the Goal, Reward:risk and account-risk % from the calculator above."/>
        </div>
        <p style={{margin:"6px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Put in what you've got — it maps the path to {tAmtE!=null?fmtMoney(tAmtE):"your goal"}.</p>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
          <span className="mono" style={{fontSize:14,color:"var(--dim)"}}>My account is $</span>
          <input value={acctBal} onChange={e=>setAcctBal(e.target.value)} placeholder="1,000" className="mono" style={{...fld,width:120,padding:"8px 10px",fontWeight:700,color:"var(--brass)"}}/>
          <span className="mono" style={{fontSize:14,color:"var(--dim)"}}>· grow it by</span>
          <input value={growPct} onChange={e=>setGrowPct(e.target.value)} placeholder="20" className="mono" style={{...fld,width:60,padding:"8px 10px",fontWeight:700,color:"var(--bull)"}}/>
          <span className="mono" style={{fontSize:14,color:"var(--dim)"}}>% over</span>
          <select value={growTf} onChange={e=>setGrowTf(e.target.value)} className="mono" style={{...fld,width:"auto",padding:"8px 10px",cursor:"pointer"}}>{DAYS.map(d=><option key={d[0]} value={d[0]}>{d[1]}</option>)}</select>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(63,183,130,0.08)",border:"1px solid var(--bull)",borderRadius:8}}>
            <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>=</span>
            <div><div className="eyebrow" style={{margin:0,fontSize:9.5,color:"var(--bull)"}}>To earn</div><div className="mono" style={{fontSize:16,fontWeight:800,color:"var(--bull)",lineHeight:1.1}}>{growTarget!=null?fmtMoney(growTarget):"—"}</div></div>
          </div>
          <Help align="left" text="Enter a growth target and the timeframe — e.g. $1,000 grow by 20% over a month = $200 to earn. It feeds that target into your goal, the calculator, and the per-day plan automatically. Leave the % blank to just use the goal you set above."/>
        </div>
        {growTarget!=null && <div style={{marginBottom:14,padding:"10px 12px",background:"rgba(63,183,130,0.06)",border:"1px solid var(--bull)",borderRadius:10}}><span className="mono" style={{fontSize:13.5,color:"var(--bone)"}}>→ Target: <b style={{color:"var(--bull)"}}>{fmtMoney(growTarget)}</b> profit <span style={{color:"var(--faint)"}}>({fmtMoney(acctB)} → {fmtMoney(acctB+growTarget)}) over {growTf==="daily"?"a day":growTf==="weekly"?"a week":growTf==="monthly"?"a month":growTf==="quarterly"?"a quarter":growTf==="semi"?"6 months":"a year"}</span></span><div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:4}}>Now driving your goal, calculator & per-day plan below.</div></div>}
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
          <span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>risking {num(riskPct)||4}%/trade · 1:{rrN}</span>
        </div>

        {acctB!=null && acctB>0 &&
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:14}}>
              {tAmtE!=null && <div style={{padding:"11px 12px",background:"rgba(63,183,130,0.06)",border:"1px solid var(--bull)",borderRadius:10}}><div className="eyebrow" style={{marginBottom:5}}>To earn</div><div className="mono" style={{fontSize:17,fontWeight:800,color:"var(--bull)"}}>{fmtMoney(tAmtE)}</div><div className="mono" style={{fontSize:11,color:"var(--faint)",marginTop:2}}>{fmtMoney(acctB)} → {fmtMoney(acctB+tAmtE)}</div></div>}
              {tAmtE!=null && <div style={{padding:"11px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}><div className="eyebrow" style={{marginBottom:5}}>Growth needed</div><div className="mono" style={{fontSize:17,fontWeight:800,color:"var(--brass)"}}>{growthPct!=null?(growthPct>=100?"+"+Math.round(growthPct):"+"+growthPct.toFixed(1))+"%":"—"}</div><div className="mono" style={{fontSize:11,color:"var(--faint)",marginTop:2}}>over the {({daily:"day",weekly:"week",monthly:"month",quarterly:"quarter",semi:"half-year",annual:"year"})[tTf]}</div></div>}
              <div style={{padding:"11px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}><div className="eyebrow" style={{marginBottom:5}}>Risk / trade</div><div className="mono" style={{fontSize:17,fontWeight:800,color:"var(--bear)"}}>{fmtMoney(acctRisk)}</div><div className="mono" style={{fontSize:11,color:"var(--faint)",marginTop:2}}>{num(riskPct)||4}% of account</div></div>
              <div style={{padding:"11px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}><div className="eyebrow" style={{marginBottom:5}}>Avg win (1:{rrN})</div><div className="mono" style={{fontSize:17,fontWeight:800,color:"var(--bull)"}}>{fmtMoney(acctWin)}</div><div className="mono" style={{fontSize:11,color:"var(--faint)",marginTop:2}}>per winner</div></div>
            </div>
            {tAmtE!=null && <>
            <div className="eyebrow" style={{marginBottom:7}}>Trades to hit {fmtMoney(tAmtE)} — flat vs compounding</div>
            <div style={{display:"flex",flexDirection:"column"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"var(--faint)",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.06em",paddingBottom:5,borderBottom:"1px solid var(--line)"}}>
                <span style={{width:44}}>Win %</span><span style={{flex:1}}>Net / trade</span><span style={{flex:1}}>Flat</span><span style={{flex:1,color:"var(--bull)"}}>Compound</span>
              </div>
              {acctScen.map(s=>(
                <div key={s.w} style={{display:"flex",alignItems:"center",gap:8,fontSize:14,padding:"7px 0",borderBottom:"1px solid var(--line)"}}>
                  <span className="mono" style={{fontWeight:800,color:"var(--bone)",width:44}}>{s.w}%</span>
                  <span className="mono" style={{color:s.exp>=0?"var(--bull)":"var(--bear)",flex:1,fontWeight:700}}>{(s.exp>=0?"+":"")+fmtMoney(s.exp)}</span>
                  <span className="mono" style={{color:s.trades!=null?"var(--bone)":"var(--bear)",flex:1,fontWeight:700}}>{s.trades!=null?`${s.trades}`:"never"}</span>
                  <span className="mono" style={{color:s.tradesC!=null?"var(--bull)":"var(--bear)",flex:1,fontWeight:700}}>{s.tradesC!=null?`${s.tradesC}`:"never"}</span>
                </div>
              ))}
            </div>
            <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:8,lineHeight:1.5}}><b style={{color:"var(--bone)"}}>Flat</b> = risk 4% of your <i>starting</i> {fmtMoney(acctB)} every trade (conservative). <b style={{color:"var(--bull)"}}>Compound</b> = risk 4% of your <i>growing</i> balance — each win makes the next size bigger, so fewer trades to the goal. Reality lands between them (compounding assumes no drawdown). Net/trade is your expectancy at that win rate.</div>

            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:14,flexWrap:"wrap"}}>
              <span className="mono" style={{fontSize:13,color:"var(--dim)"}}>Link to</span>
              <select value={linkSel} onChange={e=>setLinkSel(e.target.value)} className="mono" style={{...fld,width:"auto",padding:"8px 10px",cursor:"pointer",flex:1,minWidth:120}}>
                <option value="new">+ New goal</option>
                {missions.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <button className="btn-primary btn" style={{width:"100%",marginTop:10}} onClick={setGoalMission}>🎯 {linkSel!=="new"?`Update ${(missions.find(m=>m.id===linkSel)||{}).name||"goal"} & track`:(growTarget!=null?`Track growing ${fmtMoney(acctB)} → ${fmtMoney(acctB+growTarget)}`:"Create a goal & track it")} →</button>
            <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:6,textAlign:"center"}}>{linkSel!=="new"?"Updates that goal's target and tracks it above.":"Creates a new tracked goal above — countdown, checklist & progress."}</div>
            </>}

            <button className="btn-primary btn" style={{width:"100%",marginTop:12,opacity:(aLoad||cool>0)?0.5:1,cursor:(aLoad||cool>0)?"not-allowed":"pointer"}} onClick={findAcctPlays} disabled={aLoad||cool>0}>{aLoad?<span className="spin"/>:cool>0?`⏳ Cooling down — ${cool}s`:"🔍 Find trades to build this account"}</button>
            <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:6,textAlign:"center"}}>Scans your watchlist for setups sized to ~{fmtMoney(acctRisk)} risk — plays you can afford right now.</div>
            <AiErrLine msg={aErr}/>
            {aPlays &&
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                {aPlays.map((p,i)=>{ const short=/short|put|bear/i.test((p.dir||"")+(p.strike||"")); return (
                  <div key={i} style={{padding:"11px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:5}}>
                      <span className="mono" style={{fontSize:14.5,fontWeight:800,color:"var(--focus)"}}>{p.sym}</span>
                      <Help align="left" text={playPlain(p)}/>
                      <span className="mono" style={{fontSize:11,fontWeight:800,letterSpacing:"0.05em",padding:"2px 7px",borderRadius:5,border:"1px solid "+(short?"var(--bear)":"var(--bull)"),color:short?"var(--bear)":"var(--bull)"}}>{short?"SHORT":"LONG"}</span>
                      {p.strike && <span className="mono" style={{fontSize:12.5,fontWeight:800,color:"var(--brass)",padding:"2px 8px",borderRadius:5,background:"var(--bg3)",border:"1px solid var(--brass-dim)"}}>{p.strike}</span>}
                      {p.contracts && <span className="mono" style={{fontSize:11.5,color:"var(--dim)",padding:"2px 7px",borderRadius:5,border:"1px solid var(--line2)"}}>{p.contracts}x</span>}
                    </div>
                    {p.why && <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.5,marginBottom:6}}>{p.why}</div>}
                    <div className="mono" style={{fontSize:12,color:"var(--faint)",display:"flex",gap:12,flexWrap:"wrap"}}>
                      {p.delta && <span>Δ {p.delta}</span>}
                      {p.dte && <span>{p.dte}</span>}
                      {p.risk && <span style={{color:"var(--bear)"}}>risk {p.risk}</span>}
                      {p.target && <span style={{color:"var(--bull)"}}>target {p.target}</span>}
                    </div>
                    <PlayActions p={p} short={short} setTrades={setTrades}/>
                  </div>
                );})}
                <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:2,lineHeight:1.5}}>Sized to your {fmtMoney(acctB)} account{aTime?` · ${new Date(aTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:""} — confirm on chart/chain, wait for the trigger, run through Examine. Shortlist, not a signal.</div>
              </div>}
          </div>}
      </div>
        {mission &&
        <div style={{marginBottom:16,padding:"15px 16px",background:"var(--bg)",border:"1px solid var(--brass)",borderRadius:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0,color:"var(--brass)"}}>🎯 Goal in progress</div><Help align="left" text="Your goal broken into the required trades. Check each off as you take it and log what you ACTUALLY made in the box — the running total, the % and the bar update live, and the timer counts down to your deadline. Keep several goals at once and switch between them with the dropdown. The journal cross-check line shows your real journal P&L for the period."/></div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {missions.length>1 && <select value={activeId||""} onChange={e=>setActiveId(e.target.value)} className="mono" style={{...fld,width:"auto",padding:"5px 8px",fontSize:12.5,cursor:"pointer"}}>{missions.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>}
              <button onClick={resetMission} className="mono" style={{border:"1px solid var(--line2)",background:"transparent",color:"var(--dim)",borderRadius:7,padding:"5px 9px",fontSize:12,cursor:"pointer"}}>Delete</button>
            </div>
          </div>
          <input value={mission.name||""} onChange={e=>renameMission(e.target.value)} className="mono" style={{...fld,width:"100%",padding:"6px 9px",fontSize:13,fontWeight:700,color:"var(--brass)",marginBottom:10}}/>
          <div className="mono" style={{fontSize:14.5,fontWeight:800,color:msLeft>0?"var(--bone)":"var(--bear)",marginBottom:10}}>⏳ {fmtCountdown(msLeft)} <span style={{color:"var(--faint)",fontWeight:400,fontSize:12.5}}>left to hit {fmtMoney(mission.target)}</span></div>
          <div style={{height:8,background:"var(--bg3)",borderRadius:4,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:mPct+"%",background:mRemain<=0?"var(--bull)":"var(--brass)",transition:"width .3s"}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:8}}>
            <span className="mono" style={{fontSize:13.5,fontWeight:700,color:mTotal>=0?"var(--bull)":"var(--bear)"}}>{fmtMoney(mTotal)} of {fmtMoney(mission.target)} · {Math.round(mPct)}%</span>
            <span className="mono" style={{fontSize:13.5,color:"var(--dim)"}}>{mRemain>0?`${fmtMoney(mRemain)} to go`:"✓ goal reached!"}</span>
          </div>
          <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
            <span className="mono" style={{fontSize:12.5}}><span style={{color:"var(--bull)"}}>{mWins}W</span> <span style={{color:"var(--faint)"}}>·</span> <span style={{color:"var(--bear)"}}>{mLosses}L</span> <span style={{color:"var(--faint)"}}>of {mission.logs.length}</span></span>
            <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>Log wins AND losses — type a minus for a loss (e.g. −50); it subtracts.</span>
          </div>
          {jRef!=null && <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:10}}>Journal this {mission.tf==="weekly"?"week":"month"}: {fmtMoney(jRef)} (cross-check)</div>}
          {(()=>{ const dLeft=Math.max(1,tradingDaysBetween(new Date(),new Date(mission.deadline))); const openTrades=mission.logs.filter(l=>!l.done).length||mission.logs.length; const remAmt=Math.max(0,mRemain); const perDayAmt=remAmt/dLeft; const tPerDay=Math.max(1,Math.ceil(openTrades/dLeft)); const perTrade=mission.perTrade!=null?mission.perTrade:(openTrades?remAmt/openTrades:0); return (
          <div style={{marginBottom:12}}>
            <button onClick={()=>setShowDaily(s=>!s)} className="mono" style={{width:"100%",border:"1px solid var(--brass-dim)",background:showDaily?"var(--bg3)":"transparent",color:"var(--brass)",borderRadius:8,padding:"9px 12px",fontSize:13.5,fontWeight:700,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>📅 Suggested trades per day</span><span>{showDaily?"▾":"▸"}</span></button>
            {showDaily &&
            <div style={{marginTop:10,padding:"12px 13px",background:"var(--bg3)",border:"1px solid var(--line)",borderRadius:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <div><div className="eyebrow" style={{marginBottom:4}}>Days left</div><div className="mono" style={{fontSize:19,fontWeight:800,color:"var(--bone)"}}>{dLeft}</div></div>
                <div><div className="eyebrow" style={{marginBottom:4}}>Trades/day</div><div className="mono" style={{fontSize:19,fontWeight:800,color:"var(--focus)"}}>{tPerDay}</div></div>
                <div><div className="eyebrow" style={{marginBottom:4}}>$/day</div><div className="mono" style={{fontSize:19,fontWeight:800,color:"var(--bull)"}}>{fmtMoney(perDayAmt)}</div></div>
              </div>
              <div className="mono" style={{fontSize:12.5,color:"var(--dim)",lineHeight:1.6,marginBottom:12}}>To stay on pace: <b style={{color:"var(--bone)"}}>{tPerDay} trade{tPerDay>1?"s":""}/day</b> at <b style={{color:"var(--bull)"}}>~{fmtMoney(perTrade)}</b> each → <b style={{color:"var(--bull)"}}>{fmtMoney(perDayAmt)}/day</b> across <b style={{color:"var(--bone)"}}>{dLeft}</b> trading day{dLeft>1?"s":""}. {mDone>0?`(${mDone} done — pace adjusts as you log.)`:""}</div>
              {(()=>{ const s=acctScen.find(x=>x.w===50); return (s&&s.trades!=null)?<div className="mono" style={{fontSize:12,color:"var(--faint)",marginBottom:12,padding:"8px 11px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,lineHeight:1.5}}>Total trades to the goal @ 50% win: <b style={{color:"var(--bone)"}}>{s.trades} flat</b> / <b style={{color:"var(--bull)"}}>{s.tradesC} compounding</b> — compounding needs fewer because each win grows your size. Full table in Build my account.</div>:null; })()}
              <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto"}}>
                {Array.from({length:Math.min(dLeft,20)}).map((_,d)=>(
                  <div key={d} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 10px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8}}>
                    <span className="mono" style={{fontSize:12.5,fontWeight:700,color:"var(--brass)",width:58,flexShrink:0}}>Day {d+1}</span>
                    <span className="mono" style={{fontSize:12.5,color:"var(--focus)",flexShrink:0}}>{tPerDay} trade{tPerDay>1?"s":""}</span>
                    <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>·</span>
                    <span className="mono" style={{fontSize:12.5,color:"var(--bull)",flex:1}}>target {fmtMoney(perDayAmt)}</span>
                  </div>
                ))}
                {dLeft>20 && <div className="mono" style={{fontSize:11.5,color:"var(--faint)",textAlign:"center",padding:"4px 0"}}>+{dLeft-20} more days…</div>}
              </div>
              <div className="mono" style={{fontSize:11,color:"var(--faint)",marginTop:10,lineHeight:1.5}}>Same setup rules apply — no signal, no trade. This is a pace target, not a quota; some days you'll take 0.</div>

              <button className="btn-primary btn" style={{width:"100%",marginTop:12}} onClick={()=>scanDayTrades(tPerDay,perTrade)} disabled={dayLoad}>{dayLoad?<span className="spin"/>:`🔍 Scan today's ${tPerDay} trade${tPerDay>1?"s":""}`}</button>
              <AiErrLine msg={dayErr}/>
              {dayPlays &&
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
                  {dayPlays.map((p,i)=>{ const short=/short|put|bear/i.test((p.dir||"")+(p.strike||"")); return (
                    <div key={i} style={{padding:"11px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:5}}>
                        <span className="mono" style={{fontSize:14.5,fontWeight:800,color:"var(--focus)"}}>{p.sym}</span>
                        <Help align="left" text={playPlain(p)}/>
                        <span className="mono" style={{fontSize:11,fontWeight:800,letterSpacing:"0.05em",padding:"2px 7px",borderRadius:5,border:"1px solid "+(short?"var(--bear)":"var(--bull)"),color:short?"var(--bear)":"var(--bull)"}}>{short?"SHORT":"LONG"}</span>
                        {p.strike && <span className="mono" style={{fontSize:12.5,color:"var(--brass)"}}>{p.strike}</span>}
                      </div>
                      {p.why && <div style={{fontSize:13,color:"var(--dim)",lineHeight:1.5,marginBottom:5}}>{p.why}</div>}
                      {p.trigger && <div style={{fontSize:12.5,color:"var(--bone)",marginBottom:5}}><span className="mono" style={{color:"var(--brass-dim)",fontSize:10.5,fontWeight:800}}>WAIT FOR </span>{p.trigger}</div>}
                      <div className="mono" style={{fontSize:11.5,color:"var(--faint)",display:"flex",gap:11,flexWrap:"wrap"}}>
                        {p.delta && <span>Δ {p.delta}</span>}{p.dte && <span>{p.dte}</span>}{p.risk && <span style={{color:"var(--bear)"}}>risk {p.risk}</span>}{p.target && <span style={{color:"var(--bull)"}}>target {p.target}</span>}
                      </div>
                      <PlayActions p={p} short={short} setTrades={setTrades}/>
                    </div>
                  );})}
                  <div className="mono" style={{fontSize:11,color:"var(--faint)",lineHeight:1.5}}>Today's actionable ideas from your watchlist — confirm on chart/chain, WAIT for the trigger, run through Examine. Shortlist, not a signal.</div>
                </div>}
            </div>}
          </div>); })()}
          <div style={{maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
            {mission.logs.map((l,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 8px",background:l.done?"rgba(63,183,130,0.06)":"var(--bg3)",border:"1px solid var(--line)",borderRadius:8}}>
                <input type="checkbox" checked={l.done} onChange={()=>updLog(i,{done:!l.done})} style={{width:15,height:15,accentColor:"var(--bull)",flexShrink:0}}/>
                <span className="mono" style={{fontSize:13,fontWeight:700,color:"var(--dim)",width:64,flexShrink:0}}>Trade {i+1}</span>
                <span className="mono" style={{fontSize:11.5,color:"var(--faint)",flex:1}}>~{fmtMoney(mission.perTrade)}</span>
                <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>W/L $</span>
                <input value={l.actual} onChange={e=>updLog(i,{actual:e.target.value})} placeholder="±0" className="mono" style={{width:70,background:"var(--bg)",border:"1px solid var(--line2)",color:num(l.actual)>0?"var(--bull)":num(l.actual)<0?"var(--bear)":"var(--dim)",borderRadius:6,padding:"5px 7px",fontSize:13,fontWeight:700,outline:"none"}}/>
              </div>
            ))}
          </div>
        </div>}

      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <span className="mono" style={{fontSize:14,color:"var(--dim)"}}>My</span>
        <select value={anchor} onChange={e=>setAnchor(e.target.value)} className="mono" style={{...fld,padding:"8px 10px",cursor:"pointer"}}>
          {DAYS.map(d=><option key={d[0]} value={d[0]}>{d[1]}</option>)}
        </select>
        <span className="mono" style={{fontSize:14,color:"var(--dim)"}}>goal is $</span>
        <input value={amt} onChange={e=>setAmt(e.target.value)} placeholder="100" className="mono" style={{...fld,width:100,padding:"8px 10px",fontWeight:700,color:"var(--brass)"}}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:10,marginBottom:16}}>
        {DAYS.map(d=>{ const g=goalFor(d[0]); const actual=d[0]==="weekly"?wkP:d[0]==="monthly"?moP:null; const pct=(g&&g>0&&actual!=null)?Math.max(0,Math.min(100,actual/g*100)):null; const isAnchor=anchor===d[0]; return (
          <div key={d[0]} style={{padding:"12px 13px",background:"var(--bg)",border:"1px solid "+(isAnchor?"var(--brass-dim)":"var(--line)"),borderRadius:11}}>
            <div className="eyebrow" style={{marginBottom:6}}>{d[1]}{isAnchor?" ●":""}</div>
            <div className="mono" style={{fontSize:18,fontWeight:800,color:"var(--brass)"}}>{g!=null?fmtMoney(g):"—"}</div>
            {actual!=null && g!=null && g>0 && <div style={{marginTop:8}}>
              <div style={{height:5,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:(pct||0)+"%",background:actual>=0?"var(--bull)":"var(--bear)"}}/></div>
              <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:4}}>{fmtMoney(actual)} so far · {Math.round(actual/g*100)}%</div>
            </div>}
          </div>
        );})}
      </div>

      <div style={{borderTop:"1px solid var(--line)",paddingTop:12}}>
        <button onClick={()=>setOpen(o=>!o)} className="mono" style={{border:"none",background:"transparent",color:"var(--focus)",cursor:"pointer",fontSize:14,fontWeight:700,padding:0,display:"flex",alignItems:"center",gap:6}}>💬 Discuss my goals with the coach <span style={{color:"var(--dim)"}}>{open?"▾":"▸"}</span></button>
        {open && <div style={{marginTop:10}}>
          {msgs.length>0 && <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10,maxHeight:300,overflowY:"auto"}}>
            {msgs.map((m,i)=><div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"88%",padding:"9px 12px",borderRadius:11,fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap",background:m.role==="user"?"var(--brass-dim)":"var(--bg)",color:m.role==="user"?"#241A0A":"var(--bone)",border:m.role==="user"?"none":"1px solid var(--line)"}}>{m.content}</div>)}
            {busy && <div style={{alignSelf:"flex-start",padding:"9px 12px"}}><span className="spin"/></div>}
          </div>}
          <div style={{display:"flex",gap:8}}>
            <input value={cin} onChange={e=>setCin(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send();}} placeholder="Is a $100/day goal realistic for me?" style={{...fld,flex:1,padding:"9px 11px",fontSize:14}}/>
            <button className="btn-primary btn" onClick={send} disabled={busy||!cin.trim()}>Send</button>
          </div>
        </div>}
      </div>
    </div>
  );
}

function Futures(){
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState(""); const [time,setTime]=useState(null);
  async function load(){
    if(loading) return; setLoading(true); setErr("");
    try{
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}],
        system:`You produce a pre-market brief for an IWM options day-trader whose current lean is BEARISH (shorts a bounce into 292–294 or a break/hold below 287–288; invalidated on a reclaim above 294). Search the web for the latest index futures + today's US economic calendar. Return ONLY JSON, no prose or fences:
{"asof":"session note — overnight/globex or regular hours + time; say if market closed","items":[{"sym":"RTY","name":"Russell 2000 · IWM","chg":<pct number>},{"sym":"ES","name":"S&P 500 · SPY","chg":<#>},{"sym":"NQ","name":"Nasdaq 100 · QQQ","chg":<#>},{"sym":"YM","name":"Dow · DIA","chg":<#>}],"read":"one blunt line on the overnight tone for the cash open, small caps, gap risk and opening IV","gap":{"dir":"up|down|flat","impliedPct":<approx % IWM likely gaps at the open, number>,"fillOdds":"low|medium|high","note":"how to trade this gap — gap-and-go vs fade, and the first-15-min plan; be specific"},"rty":{"lean":"leading|lagging|inline","note":"is RTY (small caps) outperforming or lagging ES/NQ overnight — what that says about risk appetite for IWM"},"calendar":[{"time":"e.g. 8:30 AM ET","event":"report name","impact":"high|medium|low","note":"why it moves IWM — keep to a few words"}],"biasCheck":"does the overnight tone CONFIRM or FIGHT the trader's bearish IWM lean? blunt line + what it means for today's plan"}
calendar = ONLY today's scheduled US releases that move equities (ISM, jobs/NFP, JOLTS, CPI/PPI, PCE, GDP, FOMC/Fed speakers, retail sales, consumer confidence). If none today, return an empty array. Prefer hard numbers over adjectives. Use the most recent futures data available.`,
        messages:[{role:"user",content:`Latest index futures (RTY, ES, NQ, YM) overnight % change, today's US economic calendar with times ET, and the pre-market read. Today is ${todayISO()}.`}] });
      const j=extractJson(getText(res));
      if(j&&Array.isArray(j.items)){ setData(j); setTime(Date.now()); } else setErr("Couldn't load the brief — try again.");
    }catch(e){ setErr(aiErr(e,"Futures load")); }
    setLoading(false);
  }
  const impCol=(x)=> /high/i.test(x)?"var(--bear)": /med/i.test(x)?"var(--brass)":"var(--dim)";
  const gap=data&&data.gap; const gapUp=gap&&/up/i.test(gap.dir); const gapDn=gap&&/down/i.test(gap.dir);
  const rtyLead=data&&data.rty&&/lead/i.test(data.rty.lean); const rtyLag=data&&data.rty&&/lag/i.test(data.rty.lean);
  const bc=data&&data.biasCheck; const bcConfirm=bc&&/confirm/i.test(bc); const bcFight=bc&&/fight|contradict|against/i.test(bc);
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div><div className="eyebrow" style={{marginBottom:4}}>Futures · pre-market brief</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Futures & the open</h3></div>
          <Help text="Your pre-market read: overnight index futures (RTY = Russell 2000 / IWM is your key one), the implied gap for the IWM open and how to trade it, whether small caps are leading or lagging (risk appetite), today's economic calendar (IWM reacts hard to ISM, jobs, CPI, Fed), and whether the overnight tone confirms or fights your bias. Futures trade nearly 24h — a big overnight move can gap your option through your entry/stop and inflate opening IV. All AI-pulled and delayed — verify on your broker."/>
        </div>
        <button className="btn" onClick={load} disabled={loading}>{loading?<span className="spin"/>:(data?"Refresh":"Load brief")}</button>
      </div>
      <p style={{margin:"8px 0 0",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Futures tone, the gap, risk appetite, the calendar, and your bias check — before you plan a trade.</p>
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:10}}>{err}</div>}
      {loading && !data && <div className="mono" style={{fontSize:12,color:"var(--dim)",marginTop:10}}>Pulling futures, the calendar & the gap read…</div>}
      {data &&
        <div style={{marginTop:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
            {data.items.map((it,i)=>{ const c=Number(it.chg); const up=c>=0; const key=it.sym==="RTY"; return (
              <div key={i} style={{padding:"12px 13px",background:"var(--bg)",border:"1px solid "+(key?"var(--brass-dim)":"var(--line)"),borderRadius:11}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span className="mono" style={{fontSize:13.5,fontWeight:800,color:key?"var(--brass)":"var(--bone)"}}>{it.sym}</span>{key&&<span className="mono" style={{fontSize:12,color:"var(--brass-dim)"}}>YOUR INDEX</span>}</div>
                <div className="mono" style={{fontSize:18,fontWeight:800,color:isNaN(c)?"var(--dim)":up?"var(--bull)":"var(--bear)",margin:"4px 0 2px"}}>{isNaN(c)?"—":(up?"+":"")+c.toFixed(2)+"%"}</div>
                <div style={{fontSize:11.5,color:"var(--faint)",lineHeight:1.3}}>{it.name}</div>
              </div>
            );})}
          </div>
          {data.read && <div style={{marginTop:12,padding:"11px 13px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:10,fontSize:14,color:"var(--bone)",lineHeight:1.55}}><b style={{color:"var(--brass)"}}>Read:</b> {data.read}</div>}

          {gap && <div style={{marginTop:10,padding:"12px 13px",background:"var(--bg)",border:"1px solid "+(gapUp?"var(--bull)":gapDn?"var(--bear)":"var(--line2)"),borderRadius:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
              <span className="eyebrow" style={{margin:0}}>IWM gap</span>
              <span className="mono" style={{fontSize:14,fontWeight:800,color:gapUp?"var(--bull)":gapDn?"var(--bear)":"var(--dim)"}}>{gapUp?"▲ GAP UP":gapDn?"▼ GAP DOWN":"— FLAT"}{gap.impliedPct!=null&&!isNaN(Number(gap.impliedPct))?` ~${Math.abs(Number(gap.impliedPct)).toFixed(2)}%`:""}</span>
              {gap.fillOdds && <span className="mono" style={{fontSize:11.5,color:"var(--dim)"}}>fill odds: <span style={{color:impCol(gap.fillOdds),fontWeight:700}}>{gap.fillOdds}</span></span>}
            </div>
            {gap.note && <div style={{fontSize:13,color:"var(--dim)",lineHeight:1.55}}>{gap.note}</div>}
          </div>}

          {data.rty && <div style={{marginTop:10,padding:"12px 13px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
              <span className="eyebrow" style={{margin:0}}>Small-cap risk appetite</span>
              <span className="mono" style={{fontSize:13,fontWeight:800,color:rtyLead?"var(--bull)":rtyLag?"var(--bear)":"var(--dim)"}}>RTY {rtyLead?"LEADING ▲":rtyLag?"LAGGING ▼":"IN-LINE"}</span>
            </div>
            {data.rty.note && <div style={{fontSize:13,color:"var(--dim)",lineHeight:1.55}}>{data.rty.note}</div>}
          </div>}

          {Array.isArray(data.calendar) && <div style={{marginTop:10,padding:"12px 13px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
            <div className="eyebrow" style={{marginBottom:8}}>Today's calendar {data.calendar.length===0?"· clear":""}</div>
            {data.calendar.length===0
              ? <div style={{fontSize:13,color:"var(--dim)"}}>No major US data today — price action drives, not headlines.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.calendar.map((e,i)=>(
                    <div key={i} style={{display:"flex",gap:10,alignItems:"baseline"}}>
                      <span className="mono" style={{fontSize:12,fontWeight:700,color:"var(--bone)",width:82,flexShrink:0}}>{e.time}</span>
                      <span style={{width:7,height:7,borderRadius:"50%",background:impCol(e.impact||""),flexShrink:0,alignSelf:"center"}}/>
                      <span style={{fontSize:13,color:"var(--bone)",flexShrink:0}}>{e.event}</span>
                      {e.note && <span style={{fontSize:12,color:"var(--faint)",lineHeight:1.4}}>· {e.note}</span>}
                    </div>
                  ))}
                </div>}
          </div>}

          {bc && <div style={{marginTop:10,padding:"12px 13px",background:bcConfirm?"rgba(63,183,130,0.06)":bcFight?"rgba(231,106,91,0.06)":"var(--bg)",border:"1px solid "+(bcConfirm?"var(--bull)":bcFight?"var(--bear)":"var(--line2)"),borderRadius:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}><span className="eyebrow" style={{margin:0}}>Bias check</span><span className="mono" style={{fontSize:12,fontWeight:800,color:bcConfirm?"var(--bull)":bcFight?"var(--bear)":"var(--dim)"}}>{bcConfirm?"CONFIRMS":bcFight?"FIGHTS":"MIXED"}</span></div>
            <div style={{fontSize:13,color:"var(--bone)",lineHeight:1.55}}>{bc}</div>
          </div>}

          <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:10}}>{data.asof||""}{time?` · loaded ${new Date(time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:""} · AI-pulled & delayed — verify on your broker. Trade the trigger, not the gap.</div>
        </div>}
    </div>
  );
}

/* Reusable "Runners to watch" card — reads the last Runner scan, shows the strong
   ones, and (with onChart) charts them. Shared by Today and Watchlist. */
function RunnersToWatch({goRunner,onChart}){
  const [runners,setRunners]=useState([]);
  useEffect(()=>{ (async()=>{ try{ const s=await sGet("runner_scan"); if(s&&Array.isArray(s.rows)){ setRunners(s.rows.filter(r=>runnerScore(r)>=60).sort((a,b)=>runnerScore(b)-runnerScore(a)).slice(0,6)); } }catch(e){} })(); },[]);
  if(!runners.length) return null;
  return (
    <div className="card" style={{padding:18,marginBottom:18,border:"1px solid var(--brass)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:12,flexWrap:"wrap"}}>
        <div>
          <div className="eyebrow" style={{color:"var(--brass)"}}>🚀 Runners to watch</div>
          <h3 className="disp" style={{margin:"3px 0 0",fontSize:18,fontWeight:700}}>{runners.length} 1000% candidate{runners.length===1?"":"s"} from your last scan</h3>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {onChart && <button className="btn btn-primary" onClick={()=>onChart(runners[0])} style={{padding:"6px 11px",fontSize:12.5}}>📈 Chart top</button>}
          {goRunner && <button className="btn-ghost btn" onClick={goRunner}>Open Runner →</button>}
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {runners.map(r=>{ const sc=runnerScore(r); return (
          <div key={r.s} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 11px",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:9}}>
            <span className="mono" style={{fontWeight:700,fontSize:14}}>{r.s}</span>
            <span className="mono" style={{fontSize:12.5,color:r.dir==="up"?"var(--bull)":"var(--bear)"}}>{r.dir==="up"?"▲":"▼"}</span>
            <span className="mono" style={{fontWeight:700,fontSize:12.5,color:scoreTone(sc)}}>{sc}</span>
            {r.trig!=null && <span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>trig {num(r.trig)}</span>}
            {onChart && <button className="btn" onClick={()=>onChart(r)} style={{padding:"3px 8px",fontSize:11}} title={"Chart "+r.s}>📈</button>}
          </div>
        );})}
      </div>
      <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:10}}>From your last Runner scan{goRunner?" · Open Runner to set alerts →":""}</div>
    </div>
  );
}

/* Auto-loading watchlist news — free Yahoo feed, refreshes itself, no AI cost. */
function WatchlistNews({watch}){
  const [items,setItems]=useState(null);
  const [err,setErr]=useState("");
  const [when,setWhen]=useState(null);
  const [busy,setBusy]=useState(false);
  const key=(watch||[]).join(",");
  async function load(){
    if(!key){ setItems([]); return; }
    setBusy(true);
    try{
      const r=await fetch(`/api/news?symbols=${encodeURIComponent(key)}`);
      const j=await r.json().catch(()=>null);
      if(j&&Array.isArray(j.items)){ setItems(j.items); setWhen(Date.now()); setErr(""); }
      else setErr("No headlines right now.");
    }catch(e){ setErr("Couldn't load news — will retry."); }
    setBusy(false);
  }
  useEffect(()=>{ load(); const id=setInterval(load, 10*60*1000); return ()=>clearInterval(id); },[key]);
  const ago=(ts)=>{ if(!ts) return ""; const s=Math.max(0,(Date.now()-ts)/1000); if(s<60)return"just now"; const m=s/60; if(m<60)return Math.round(m)+"m ago"; const h=m/60; if(h<24)return Math.round(h)+"h ago"; return Math.round(h/24)+"d ago"; };
  return (
    <div className="card" style={{padding:18}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <div className="eyebrow" style={{margin:0}}>Watchlist news</div>
        <Help text="Latest headlines for your watchlist tickers, pulled free from Yahoo Finance and refreshed automatically every 10 minutes — no AI tokens used. Tap a headline to open the article. Delayed/best-effort — verify anything you'd trade on."/>
        <span className="mono" style={{marginLeft:"auto",fontSize:11.5,color:"var(--faint)"}}>{busy?"updating…":when?"updated "+ago(when):""}</span>
        <button className="btn" onClick={load} disabled={busy} style={{padding:"4px 9px",fontSize:12}}>↻</button>
      </div>
      <div style={{fontSize:12.5,color:"var(--dim)",marginBottom:12}}>Auto-updates for {(watch||[]).slice(0,6).join(", ")}{watch&&watch.length>6?` +${watch.length-6} more`:""}. Free · no AI.</div>
      {items===null && <div className="mono" style={{fontSize:13,color:"var(--faint)"}}>Loading headlines…</div>}
      {items && !items.length && <div style={{fontSize:13,color:"var(--faint)"}}>{err||"No fresh headlines for your tickers right now."}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:440,overflowY:"auto"}}>
        {(items||[]).map((it,i)=>(
          <a key={i} href={it.link||undefined} target="_blank" rel="noopener" style={{display:"block",padding:"10px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10,textDecoration:"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
              <span className="mono" style={{fontWeight:700,fontSize:12.5,color:"var(--brass)"}}>{it.ticker||"MKT"}</span>
              <span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>{it.source}{it.ts?" · "+ago(it.ts):""}</span>
            </div>
            <div style={{fontSize:14,fontWeight:600,color:"var(--bone)",lineHeight:1.35}}>{it.headline} <span style={{color:"var(--focus)",fontSize:12}}>↗</span></div>
          </a>))}
      </div>
    </div>
  );
}
function Today({trades,setTrades,watch,quotes,setQuotes,goJournal,goRunner}){
  const [brief,setBrief]=useState("");
  const [loadingB,setLoadingB]=useState(false);
  const [loadingQ,setLoadingQ]=useState(false);
  const [err,setErr]=useState("");
  const [todayChart,setTodayChart]=useState(null);

  const closed = trades.map(t=>({...t,pnl:computePnl(t)})).filter(t=>t.pnl!=null);
  const sow=startOfWeek();
  const now=new Date();
  const wk = closed.filter(t=>new Date(t.date)>=sow).reduce((a,t)=>a+t.pnl,0);
  const mo = closed.filter(t=>{const d=new Date(t.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce((a,t)=>a+t.pnl,0);
  const wins=closed.filter(t=>t.pnl>0).length;
  const wr = closed.length?Math.round(wins/closed.length*100):0;
  const discip = trades.length?Math.round(trades.filter(t=>t.planFollowed).length/trades.length*100):0;

  useEffect(()=>{ if(watch&&watch.length) syncQuotes(); },[]); // free auto-load prices on open (no AI)
  async function syncQuotes(){
    setLoadingQ(true); setErr("");
    try{
      const r=await fetch(`/api/quotes?symbols=${encodeURIComponent((watch||[]).join(","))}`);
      const j=await r.json().catch(()=>null);
      if(j&&j.quotes&&typeof j.quotes==="object") setQuotes(q=>({...q,...j.quotes}));
      else setErr((j&&j.error)||"Couldn't load quotes — try again.");
    }catch(e){ setErr("Quote sync failed. Check connection and retry."); }
    setLoadingQ(false);
  }
  async function genBrief(){
    setLoadingB(true); setErr("");
    try{
      const data=await callClaude({ maxTokens:1000,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        system:"You are a pre-market desk analyst for a Strat trader who trades IWM and AI/semiconductor names with options. Search for today's most market-moving items. Write a tight brief (max ~140 words): 1) overnight/index tone, 2) the 2-3 catalysts that matter for small caps + semis, 3) any scheduled events today (Fed/CPI/earnings) that create IV-crush risk. Plain prose, no lists longer than 3, no fluff. End with one line: 'Bias:' one sentence.",
        messages:[{role:"user",content:`Morning brief for ${todayISO()}. Watchlist: ${watch.join(", ")}.`}]
      });
      const t=getText(data); setBrief(t||"No brief returned — try again.");
    }catch(e){ setErr("Brief generation failed. Check connection and retry."); }
    setLoadingB(false);
  }

  return (
    <div>
      <div style={{marginBottom:18}}><Goals trades={trades} setTrades={setTrades} watch={watch}/></div>

      {todayChart && <ChartModal row={todayChart} onClose={()=>setTodayChart(null)}/>}
      <RunnersToWatch goRunner={goRunner} onChart={setTodayChart}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:18}}>
        <Stat label="Week P&L" value={fmtMoney(wk)} tone={wk} help="Your total profit/loss on trades closed since Monday. Green = up week, red = down week." />
        <Stat label="Month P&L" value={fmtMoney(mo)} tone={mo} help="Total profit/loss on trades closed this calendar month." />
        <Stat label="Win rate" value={closed.length?wr+"%":"—"} sub={`${closed.length} closed`} help="Share of your closed trades that made money. Note: a high win rate with big losers can still lose money — pair it with avg win vs. loss." />
        <Stat label="Discipline" value={trades.length?discip+"%":"—"} sub="plan followed" help="Share of trades you marked 'plan followed.' This is YOUR real scoreboard — process over outcome. Tap 'on plan ✓/✗' on any trade to correct it." />
      </div>

      <div style={{marginBottom:18}}><Futures/></div>

      <div style={{marginBottom:18}}><WatchlistNews watch={watch}/></div>

      <div style={{marginBottom:18}}><AgentActions trades={trades} watch={watch}/></div>
      <div style={{marginBottom:18}}><ExamineMulti watch={watch}/></div>

      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:16}}>
        {/* Recent trades peek */}
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div><div className="eyebrow">Journal</div><h3 className="disp" style={{margin:"3px 0 0",fontSize:18,fontWeight:700}}>Last trades</h3></div>
            <button className="btn-ghost btn" onClick={goJournal}>Open journal →</button>
          </div>
          {closed.length===0
            ? <p style={{margin:0,color:"var(--dim)",fontSize:15}}>No trades logged yet. Log the wins, the losses, and the ones that never triggered — the edge is in the pattern.</p>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...trades].slice(-4).reverse().map(t=>{const p=computePnl(t);return(
                  <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",background:"var(--bg)",borderRadius:9,border:"1px solid var(--line)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span className="mono" style={{fontWeight:600,fontSize:14.5}}>{t.ticker}</span>
                      <span className="tag">{t.setup}</span>
                      <span className="mono" style={{fontSize:12.5,color:"var(--dim)"}}>{t.direction} · {t.instrument}</span>
                    </div>
                    <span className="mono" style={{fontWeight:600,fontSize:14.5,color:p>=0?"var(--bull)":"var(--bear)"}}>{fmtMoney(p)}</span>
                  </div>
                );})}
              </div>}
        </div>

        <Notes/>
      </div>
    </div>
  );
}

const SEED_NOTES2=[
  {id:"seed-iwm-bear1", text:"IWM bearish thesis (Aug 1): lower highs + lower lows in a descending channel since the ~304 Jul 1 peak. Bounces get sold.", done:false},
  {id:"seed-iwm-bear2", text:"IWM short trigger: wait for a bounce into 292–294 resistance, then a 2-down break of the prior bar's low. OR a break-and-hold below 287–288.", done:false},
  {id:"seed-iwm-bear3", text:"IWM stop being bearish: reclaim & HOLD above ~294 (channel top) = downtrend paused, thesis dead.", done:false},
  {id:"seed-iwm-bear4", text:"IWM short targets: 287–288 → 284 → 282. Scale out into each; never hold puts to zero (the old leak).", done:false},
  {id:"seed-iwm-bear5", text:"Catalysts: Mon Aug 3 ISM 10am ET + Fri Aug 7 jobs. Weak data = fuel for the short; don't hold naked into the prints.", done:false},
];
const SEED_NOTES=[
  {id:"seed-rh", text:"Go on Robinhood pre-market to watch how tickers are moving overnight.", done:false},
];
function Notes(){
  const [list,setList]=useState([]);
  const [ready,setReady]=useState(false);
  const [draft,setDraft]=useState("");
  useEffect(()=>{(async()=>{
    let l=await sGet("notes:list"); if(!Array.isArray(l)) l=[];
    const seeded=await sGet("notes:seededV1");
    if(!seeded){ l=[...SEED_NOTES.filter(s=>!l.some(n=>n.id===s.id)),...l]; await sSet("notes:seededV1",true); }
    const seeded2=await sGet("notes:seededV2");
    if(!seeded2){ l=[...SEED_NOTES2.filter(s=>!l.some(n=>n.id===s.id)),...l]; await sSet("notes:seededV2",true); }
    setList(l); setReady(true);
  })();},[]);
  useEffect(()=>{ if(ready) sSet("notes:list",list); },[list,ready]);
  const add=()=>{const t=draft.trim(); if(!t)return; setList(l=>[...l,{id:Date.now()+"",text:t,done:false}]); setDraft("");};
  const toggle=id=>setList(l=>l.map(n=>n.id===id?{...n,done:!n.done}:n));
  const del=id=>setList(l=>l.filter(n=>n.id!==id));
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Reminders</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 12px",fontSize:18,fontWeight:700}}>Notes & routine</h3><Help text="Your scratchpad and reminders — the stuff you want in front of you before you trade. Right now it holds your bearish IWM thesis, the trigger/invalidation levels, and next week's catalysts. Type a note, check it off when done."/></div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <input placeholder="Add a note or reminder…" value={draft}
          onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")add();}}/>
        <button className="btn" onClick={add}>Add</button>
      </div>
      {list.length===0
        ? <p style={{margin:0,color:"var(--dim)",fontSize:14.5}}>No notes yet. Jot reminders for your morning routine here.</p>
        : <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {list.map(n=>(
              <div key={n.id} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9}}>
                <button onClick={()=>toggle(n.id)} title="Mark done"
                  style={{width:18,height:18,flexShrink:0,borderRadius:5,cursor:"pointer",border:"1.5px solid "+(n.done?"var(--brass)":"var(--line2)"),
                    background:n.done?"var(--brass)":"transparent",color:"#241A0A",fontSize:12.5,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{n.done?"✓":""}</button>
                <span style={{flex:1,fontSize:14.5,lineHeight:1.4,color:n.done?"var(--faint)":"var(--bone)",textDecoration:n.done?"line-through":"none"}}>{n.text}</span>
                <button onClick={()=>del(n.id)} style={{background:"none",border:"none",color:"var(--faint)",fontSize:16,cursor:"pointer"}} title="Delete">×</button>
              </div>
            ))}
          </div>}
    </div>
  );
}
function Stat({label,value,sub,tone,help}){
  const col = tone==null?"var(--bone)": tone>0?"var(--bull)": tone<0?"var(--bear)":"var(--bone)";
  return (
    <div className="card" style={{padding:"15px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:8}}>
        <div className="eyebrow" style={{margin:0}}>{label}</div>
        {help && <Help text={help}/>}
      </div>
      <div className="mono" style={{fontSize:24,fontWeight:700,color:col,lineHeight:1}}>{value}</div>
      {sub && <div className="mono" style={{fontSize:12.5,color:"var(--faint)",marginTop:5}}>{sub}</div>}
    </div>
  );
}

/* ============================ JOURNAL ============================ */
const BLANK={date:todayISO(),ticker:"",instrument:"Stock",direction:"Long",optType:"Call",strike:"",expiry:"",entry:"",exit:"",quantity:"",multiplier:"",setup:"2-2 continuation",timeframe:"15m",horizon:"Day",pnlManual:"",planFollowed:true,emotion:"On plan",notes:"",img:null};

function Journal({trades,setTrades,watch}){
  const [d,setD]=useState(BLANK);
  const [filter,setFilter]=useState("all");
  const fileRef=useRef(null);
  const set=(k,v)=>setD(s=>({...s,[k]:v}));
  const previewPnl=computePnl(d);
  async function pickImg(e){ const f=(e.target.files||[])[0]; if(!f) return; try{ const t=await fileToThumb(f); set("img",t); }catch(_){}; if(fileRef.current) fileRef.current.value=""; }
  const shotRef=useRef(null);
  const [reading,setReading]=useState(false); const [rerr,setRerr]=useState("");
  async function readShot(e){
    const f=(e.target.files||[])[0]; if(!f) return;
    setReading(true); setRerr("");
    try{
      const [full,thumb]=await Promise.all([fileToB64(f), fileToThumb(f)]);
      const res=await callClaude({ maxTokens:800,
        system:"You read a broker trade screenshot (Robinhood, Webull, etc.) and extract the trade. Return ONLY JSON — no prose, no markdown fences: {\"date\":\"YYYY-MM-DD\",\"ticker\":\"\",\"instrument\":\"Stock|Option|Future\",\"direction\":\"Long|Short\",\"optType\":\"Call|Put|\",\"strike\":\"\",\"expiry\":\"YYYY-MM-DD\",\"entry\":\"\",\"exit\":\"\",\"quantity\":\"\",\"pnlManual\":\"\"}. Rules: a BOUGHT call or put = Long. entry/exit are the AVG PER-CONTRACT price for options (e.g. cost $0.80 avg → entry \"0.80\") or per-share for stock — NOT dollar totals. date = the closed/realized date. expiry from the option label (e.g. '5/26' this year). pnlManual = the realized P&L number, negative for a loss. Any unknown field = empty string.",
        messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:full.media_type,data:full.data}},{type:"text",text:"Extract this trade to JSON."}]}] });
      const j=extractJson(getText(res));
      if(j&&typeof j==="object"&&(j.ticker||j.pnlManual)){
        setD(s=>({...s,
          date:j.date||s.date, ticker:(j.ticker||"").toUpperCase(), instrument:j.instrument||"Option",
          direction:j.direction||"Long", optType:j.optType||"Call", strike:j.strike!=null?String(j.strike):"", expiry:j.expiry||"",
          entry:j.entry!=null?String(j.entry):"", exit:j.exit!=null?String(j.exit):"", quantity:j.quantity!=null?String(j.quantity):"",
          pnlManual:j.pnlManual!=null?String(j.pnlManual):"", img:thumb }));
      } else setRerr("Couldn't read that one — try a clearer shot, or fill it in below.");
    }catch(err){ setRerr(aiErr(err,"Screenshot read")); }
    setReading(false);
    if(shotRef.current) shotRef.current.value="";
  }

  function add(){
    if(!d.ticker.trim()) return;
    const entry={...d,ticker:d.ticker.toUpperCase().trim(),id:Date.now()+"-"+Math.random().toString(36).slice(2,6)};
    setTrades(t=>[...t,entry]);
    setD({...BLANK,date:d.date});
  }
  function del(id){ setTrades(t=>t.filter(x=>x.id!==id)); }
  function togglePlan(id){ setTrades(t=>t.map(x=>x.id===id?{...x,planFollowed:!x.planFollowed}:x)); }
  function setSetup(id,v){ setTrades(t=>t.map(x=>x.id===id?{...x,setup:v}:x)); }
  function setGrade(id,v){ setTrades(t=>t.map(x=>x.id===id?{...x,grade:v==="—"?undefined:v}:x)); }
  const [grading,setGrading]=useState(false); const [gerr,setGerr]=useState("");
  const [edgeHelp,setEdgeHelp]=useState(false);
  async function autoGrade(){
    if(grading) return; setGrading(true); setGerr("");
    try{
      const sys=await withKB(MENTOR_SYS+"\n\nTASK — Grade each trade's DISCIPLINE (process, not P&L) against the 6-step pipeline: real trigger? sized off the stop? scaled out into strength? right strike/DTE (delta 0.55–0.70, not far-OTM)? closed 0DTE before 3:30? not held to zero? A = textbook discipline, F = the leak (far-OTM/held-to-expiration/no trigger). Return ONLY a JSON array [{\"id\":\"<id>\",\"grade\":\"A|B|C|D|F\"}] covering every id. No prose, no fences.");
      const lines=trades.map(t=>{const p=computePnl(t); const det=t.instrument==="Option"?`${t.optType||""}${t.strike||""} exp${t.expiry||""}`:t.instrument; return `id ${t.id} :: ${t.date} ${t.ticker} ${det} ${t.direction} setup=${t.setup} ${t.horizon||"?"}/${t.timeframe||"?"} in ${t.entry||"?"}→out ${t.exit||"?"} x${t.quantity||"?"} P&L ${fmtMoney(p)} plan=${t.planFollowed?"y":"n"} ${t.notes||""}`;}).join("\n");
      const data=await callClaude({ maxTokens:1000, system:sys, messages:[{role:"user",content:"Grade every trade:\n"+lines}] });
      const j=extractJson(getText(data));
      if(Array.isArray(j)&&j.length){
        const map={}; j.forEach(x=>{ if(x&&x.id&&x.grade) map[String(x.id)]=String(x.grade).toUpperCase().replace(/[^ABCDF]/g,"").slice(0,1); });
        setTrades(ts=>ts.map(t=> map[t.id]?{...t,grade:map[t.id]}:t));
      } else setGerr("Couldn't parse grades — try again.");
    }catch(e){ setGerr(aiErr(e,"Grading")); }
    setGrading(false);
  }

  const list=[...trades].reverse().filter(t=> filter==="all"?true : filter==="wins"?computePnl(t)>0 : filter==="losses"?computePnl(t)<0 : t.setup===filter);

  // by-setup edge table
  const bySetup={};
  trades.forEach(t=>{const p=computePnl(t); if(p==null)return; const k=t.setup; bySetup[k]=bySetup[k]||{n:0,w:0,pnl:0}; bySetup[k].n++; if(p>0)bySetup[k].w++; bySetup[k].pnl+=p;});
  const setupRows=Object.entries(bySetup).sort((a,b)=>b[1].pnl-a[1].pnl);

  return (
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,360px) 1fr",gap:18,alignItems:"start"}} className="jgrid">
      <style>{`@media(max-width:820px){.jgrid{grid-template-columns:1fr !important;}}`}</style>

      {/* Form */}
      <div className="card" style={{padding:18}}>
        <div className="eyebrow" style={{marginBottom:4}}>New entry</div>
        <div style={{display:"flex",alignItems:"center",gap:8,margin:"0 0 12px"}}><h3 className="disp" style={{margin:0,fontSize:18,fontWeight:700}}>Log a trade</h3><Help text="Fastest way: tap 'Add from screenshot' and upload a broker trade card — it reads the ticker, strike, entry/exit and P&L and fills everything in. Or type it by hand. Every logged trade flows into your History, stats, edge table, and the coach automatically."/></div>

        <input ref={shotRef} type="file" accept="image/*" onChange={readShot} style={{display:"none"}}/>
        <button className="btn-primary btn" style={{width:"100%",padding:"12px",fontSize:15.5}} onClick={()=>shotRef.current&&shotRef.current.click()} disabled={reading}>
          {reading?<><span className="spin"/> Reading your screenshot…</>:"📸 Add from screenshot"}
        </button>
        {rerr && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:8}}>{rerr}</div>}
        <div className="mono" style={{fontSize:12,color:"var(--faint)",margin:"8px 0 4px",lineHeight:1.5}}>Upload a broker trade screenshot — it reads the ticker, strike, entry/exit and P&L and fills everything below. Glance, then tap Log. No typing.</div>
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"12px 0"}}>
          <div style={{flex:1,height:1,background:"var(--line)"}}/>
          <span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>or enter by hand</span>
          <div style={{flex:1,height:1,background:"var(--line)"}}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Field label="Date"><input type="date" value={d.date} onChange={e=>set("date",e.target.value)}/></Field>
          <Field label="Ticker">
            <input list="wl" className="mono" placeholder="IWM" value={d.ticker} onChange={e=>set("ticker",e.target.value.toUpperCase())}/>
            <datalist id="wl">{watch.map(w=><option key={w} value={w}/>)}</datalist>
          </Field>
          <Field label="Instrument"><select value={d.instrument} onChange={e=>set("instrument",e.target.value)}>{["Stock","Option","Future"].map(x=><option key={x}>{x}</option>)}</select></Field>
          <Field label="Direction"><select value={d.direction} onChange={e=>set("direction",e.target.value)}>{["Long","Short"].map(x=><option key={x}>{x}</option>)}</select></Field>
        </div>

        {d.instrument==="Option" &&
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:10}}>
            <Field label="Type"><select value={d.optType} onChange={e=>set("optType",e.target.value)}>{["Call","Put"].map(x=><option key={x}>{x}</option>)}</select></Field>
            <Field label="Strike"><input className="mono" value={d.strike} onChange={e=>set("strike",e.target.value)}/></Field>
            <Field label="Expiry"><input type="date" value={d.expiry} onChange={e=>set("expiry",e.target.value)}/></Field>
          </div>}
        {d.instrument==="Future" &&
          <div style={{marginTop:10}}><Field label="Point multiplier ($/pt)"><input className="mono" placeholder="e.g. 50 (ES) / 5 (MES)" value={d.multiplier} onChange={e=>set("multiplier",e.target.value)}/></Field></div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:10}}>
          <Field label="Entry"><input className="mono" value={d.entry} onChange={e=>set("entry",e.target.value)}/></Field>
          <Field label="Exit"><input className="mono" value={d.exit} onChange={e=>set("exit",e.target.value)}/></Field>
          <Field label={d.instrument==="Option"?"Contracts":"Qty"}><input className="mono" value={d.quantity} onChange={e=>set("quantity",e.target.value)}/></Field>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
          <Field label="Setup / trigger"><select value={d.setup} onChange={e=>set("setup",e.target.value)}>{SETUPS.map(x=><option key={x}>{x}</option>)}</select></Field>
          <Field label="Timeframe"><select value={d.timeframe} onChange={e=>set("timeframe",e.target.value)}>{TFS.map(x=><option key={x}>{x}</option>)}</select></Field>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:10}}>
          <Field label="Horizon"><select value={d.horizon} onChange={e=>set("horizon",e.target.value)}>{HORIZONS.map(x=><option key={x}>{x}</option>)}</select></Field>
          <Field label="Manual P&L (optional)"><input className="mono" placeholder={previewPnl!=null?`auto ${fmtMoney(previewPnl)}`:"$"} value={d.pnlManual} onChange={e=>set("pnlManual",e.target.value)}/></Field>
          <Field label="Execution"><select value={d.emotion} onChange={e=>set("emotion",e.target.value)}>{EMOTIONS.map(x=><option key={x}>{x}</option>)}</select></Field>
        </div>

        <label style={{display:"flex",alignItems:"center",gap:9,margin:"12px 0",cursor:"pointer",fontSize:14.5,color:"var(--dim)"}}>
          <input type="checkbox" style={{width:16,height:16,accentColor:"var(--brass)"}} checked={d.planFollowed} onChange={e=>set("planFollowed",e.target.checked)}/>
          Followed my plan (trigger + stop + target)
        </label>

        <Field label="Notes — what triggered it, what you saw">
          <textarea rows={3} placeholder="FTFC aligned D+60m, entered on 2-up break of prior candle high, stop under trigger, target next pivot…" value={d.notes} onChange={e=>set("notes",e.target.value)}/>
        </Field>

        {d.img &&
          <div style={{marginTop:12,display:"flex",alignItems:"center",gap:10}}>
            <img src={d.img} alt="chart" style={{width:44,height:44,objectFit:"cover",borderRadius:8,border:"1px solid var(--line2)"}}/>
            <span className="mono" style={{fontSize:12.5,color:"var(--dim)"}}>screenshot attached</span>
            <button onClick={()=>set("img",null)} className="mono" style={{background:"none",border:"none",color:"var(--faint)",fontSize:13.5,cursor:"pointer"}}>remove</button>
          </div>}

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:14}}>
          <span className="mono" style={{fontSize:14.5,color: previewPnl==null?"var(--faint)": previewPnl>=0?"var(--bull)":"var(--bear)"}}>
            {previewPnl!=null?`P&L ${fmtMoney(previewPnl)}`:"P&L —"}
          </span>
          <button className="btn-primary btn" onClick={add}>Log trade</button>
        </div>
      </div>

      {/* Right: edge table + list */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {setupRows.length>0 &&
          <div className="card" style={{padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
              <div className="eyebrow" style={{margin:0}}>Which setups pay — your edge by trigger</div>
              <button onClick={()=>setEdgeHelp(h=>!h)} title="What is this?" className="mono"
                style={{width:22,height:22,borderRadius:"50%",border:"1px solid var(--line2)",background:edgeHelp?"var(--brass)":"var(--bg)",color:edgeHelp?"#241A0A":"var(--dim)",fontSize:13.5,fontWeight:800,cursor:"pointer",lineHeight:1,flexShrink:0}}>{edgeHelp?"×":"?"}</button>
            </div>
            {edgeHelp &&
              <div style={{padding:"13px 15px",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:11,marginBottom:14,fontSize:14,lineHeight:1.6,color:"var(--dim)"}}>
                This groups every logged trade by its <b style={{color:"var(--bone)"}}>setup/trigger</b> and shows how each one actually performs:
                <div style={{margin:"8px 0",display:"flex",flexDirection:"column",gap:4}}>
                  <div><b style={{color:"var(--brass)"}}>N</b> — how many trades used that setup</div>
                  <div><b style={{color:"var(--brass)"}}>Win%</b> — how many were profitable</div>
                  <div><b style={{color:"var(--brass)"}}>Net P&L</b> — total dollars that setup has made or lost you</div>
                </div>
                <b style={{color:"var(--bone)"}}>This is your edge</b> — it tells you which triggers to keep taking and which to cut. Tag each trade's setup (tap the gold tag on any trade in History) so this fills in. Right now most of your trades sit in <b style={{color:"var(--bear)"}}>“Other”</b> and it's deep red — that's the signal: categorize them and you'll see exactly which setups win versus which ones bleed the account.
              </div>}
            <div style={{display:"grid",gridTemplateColumns:"1.4fr .5fr .5fr 1fr 16px",gap:8,fontSize:13.5,padding:"0 12px 8px"}}>
              <div className="eyebrow">Setup</div><div className="eyebrow" style={{textAlign:"right"}}>N</div><div className="eyebrow" style={{textAlign:"right"}}>Win%</div><div className="eyebrow" style={{textAlign:"right"}}>Net P&L</div><div/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {setupRows.map(([k,v])=>(
                <EdgeRow key={k} setup={k} v={v} rows={trades.filter(t=>t.setup===k && computePnl(t)!=null)}/>
              ))}
            </div>
            <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:10}}>Tap any setup to expand its stats, trades, and get a coaching brief.</div>
          </div>}

        <div className="card" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:0,fontSize:18,fontWeight:700}}>History <span className="mono" style={{fontSize:14.5,color:"var(--dim)",fontWeight:400}}>({trades.length})</span></h3><Help text="Every logged trade. On each row you can tap the gold SETUP tag to categorize it, the A–F grade, and 'on plan ✓/✗' — plus 💬 to ask the coach about that trade. '⚡ Auto-grade' lets the coach grade every trade's discipline at once."/></div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <button className="btn" onClick={autoGrade} disabled={grading||!trades.length} title="Let the coach grade every trade's discipline A–F">{grading?<span className="spin"/>:"⚡ Auto-grade"}</button>
              <select style={{width:"auto"}} value={filter} onChange={e=>setFilter(e.target.value)}>
                <option value="all">All trades</option><option value="wins">Wins</option><option value="losses">Losses</option>
                {SETUPS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {gerr && <div style={{color:"var(--bear)",fontSize:13.5,marginBottom:10}}>{gerr}</div>}
          {list.length===0
            ? <p style={{margin:0,color:"var(--dim)",fontSize:15}}>Nothing here yet. Your first logged trade starts the data set that tells you which triggers to keep taking.</p>
            : <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:520,overflow:"auto"}} className="scroll">
                {list.map(t=><TradeRow key={t.id} t={t} onDel={()=>del(t.id)} onToggle={()=>togglePlan(t.id)} onSetSetup={(v)=>setSetup(t.id,v)} onSetGrade={(v)=>setGrade(t.id,v)}/>)}
              </div>}
        </div>
      </div>
    </div>
  );
}
function Field({label,children}){
  return <label style={{display:"block"}}><div className="eyebrow" style={{marginBottom:5}}>{label}</div>{children}</label>;
}
function EdgeRow({setup,v,rows}){
  const [open,setOpen]=useState(false);
  const [brief,setBrief]=useState(""); const [loading,setLoading]=useState(false); const [err,setErr]=useState("");
  const pnls=rows.map(computePnl);
  const wins=pnls.filter(p=>p>0), losses=pnls.filter(p=>p<0);
  const avgW=wins.length?wins.reduce((a,b)=>a+b,0)/wins.length:0;
  const avgL=losses.length?losses.reduce((a,b)=>a+b,0)/losses.length:0;
  const best=rows.length?rows.reduce((m,t)=>computePnl(t)>computePnl(m)?t:m):null;
  const worst=rows.length?rows.reduce((m,t)=>computePnl(t)<computePnl(m)?t:m):null;
  const col=v.pnl>=0?"var(--bull)":"var(--bear)";
  async function doBrief(){
    if(loading) return; setLoading(true); setErr("");
    try{
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — Brief me on ONE setup from my journal: "${setup}". From its trades, in 4–6 tight lines: is this a real edge to KEEP taking or a leak to CUT? What's the pattern — win rate, avg win vs avg loss, what the winners share vs what the losers share? Finish with one concrete instruction for next time. Blunt, specific, no fluff.`);
      const data=await callClaude({ maxTokens:700, system:sys, messages:[{role:"user",content:`Setup "${setup}" — ${rows.length} trades:\n`+tradesToText(rows)}] });
      setBrief(getText(data)||"No response — try again.");
    }catch(e){ setErr(aiErr(e,"Brief")); }
    setLoading(false);
  }
  return (
    <div style={{border:"1px solid "+(open?"var(--line2)":"var(--line)"),borderRadius:10,overflow:"hidden",background:open?"var(--bg)":"transparent"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"grid",gridTemplateColumns:"1.4fr .5fr .5fr 1fr 16px",gap:8,alignItems:"center",padding:"10px 12px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
        <span style={{fontSize:14,color:"var(--bone)"}}>{setup}</span>
        <span className="mono" style={{textAlign:"right",fontSize:14,color:"var(--dim)"}}>{v.n}</span>
        <span className="mono" style={{textAlign:"right",fontSize:14,color:"var(--dim)"}}>{Math.round(v.w/v.n*100)}%</span>
        <span className="mono" style={{textAlign:"right",fontSize:14,fontWeight:700,color:col}}>{fmtMoney(v.pnl)}</span>
        <span className="mono" style={{textAlign:"right",fontSize:12.5,color:"var(--dim)"}}>{open?"▾":"▸"}</span>
      </button>
      {open &&
        <div style={{padding:"4px 12px 14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginBottom:12}}>
            {[["Avg win",fmtMoney(avgW),"var(--bull)"],["Avg loss",fmtMoney(avgL),"var(--bear)"],["Best",best?fmtMoney(computePnl(best)):"—","var(--bull)"],["Worst",worst?fmtMoney(computePnl(worst)):"—","var(--bear)"]].map(([k,val,c])=>(
              <div key={k} style={{padding:"8px 10px",background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:8}}>
                <div className="eyebrow" style={{marginBottom:4}}>{k}</div>
                <div className="mono" style={{fontSize:14.5,fontWeight:700,color:c}}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{maxHeight:170,overflow:"auto",display:"flex",flexDirection:"column",gap:5,marginBottom:12}} className="scroll">
            {[...rows].sort((a,b)=>computePnl(b)-computePnl(a)).map(t=>{const p=computePnl(t);const det=t.instrument==="Option"?`${t.optType||""} ${t.strike||""}`.trim():t.instrument;return(
              <div key={t.id} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"6px 10px",background:"var(--bg2)",borderRadius:7,fontSize:13}}>
                <span className="mono" style={{color:"var(--dim)"}}>{t.date} · {t.ticker} {det}{t.grade?` · ${t.grade}`:""}</span>
                <span className="mono" style={{fontWeight:700,color:p>=0?"var(--bull)":"var(--bear)"}}>{fmtMoney(p)}</span>
              </div>
            );})}
          </div>
          <button className="btn-primary btn" onClick={doBrief} disabled={loading} style={{width:"100%"}}>{loading?<span className="spin"/>:"🧠 Brief me on this setup"}</button>
          {err && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:8}}>{err}</div>}
          {brief && <div style={{marginTop:12,padding:13,background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:9,fontSize:14.5,lineHeight:1.6,whiteSpace:"pre-wrap",color:"var(--bone)"}}>{brief}</div>}
        </div>}
    </div>
  );
}

function gradeColor(g){ if(g==="A"||g==="B") return "var(--bull)"; if(g==="C") return "var(--brass)"; if(g==="D"||g==="F") return "var(--bear)"; return "var(--faint)"; }
function TradeRow({t,onDel,onToggle,onSetSetup,onSetGrade}){
  const p=computePnl(t);
  const [chat,setChat]=useState(false);
  const detail = t.instrument==="Option" ? `${t.optType} ${t.strike||""} ${t.expiry||""}`.trim() : t.instrument;
  return (
    <div style={{padding:"11px 13px",background:"var(--bg)",borderRadius:10,border:"1px solid var(--line)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
          <span className="mono" style={{fontWeight:700,fontSize:15.5}}>{t.ticker}</span>
          <span className="tag" style={{color: t.direction==="Long"?"var(--bull)":"var(--bear)",borderColor:"var(--line2)"}}>{t.direction}</span>
          <select value={t.setup} onChange={e=>onSetSetup(e.target.value)} onClick={e=>e.stopPropagation()} title="Set the trigger / setup"
            style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,fontWeight:600,padding:"2px 20px 2px 7px",borderRadius:5,border:"1px solid var(--line2)",background:"var(--bg2)",color:"var(--brass)",cursor:"pointer",width:"auto",maxWidth:150}}>
            {SETUPS.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>{t.horizon||"—"} · {t.timeframe} · {detail}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <select value={t.grade||"—"} onChange={e=>onSetGrade(e.target.value)} onClick={e=>e.stopPropagation()} title="Discipline grade (A–F)"
            style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12.5,fontWeight:800,padding:"2px 6px",borderRadius:5,border:"1px solid var(--line2)",background:"var(--bg2)",color:gradeColor(t.grade),cursor:"pointer",width:"auto"}}>
            {["—","A","B","C","D","F"].map(g=><option key={g} value={g}>{g==="—"?"grade":g}</option>)}
          </select>
          <span className="mono" style={{fontWeight:700,fontSize:15.5,color:p==null?"var(--dim)":p>=0?"var(--bull)":"var(--bear)"}}>{fmtMoney(p)}</span>
          <button className="btn-ghost" onClick={onDel} style={{background:"none",border:"none",color:"var(--faint)",fontSize:16,padding:2}} title="Delete">×</button>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
        <span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>
          {t.date} {t.entry&&`· in ${t.entry}`} {t.exit&&`→ out ${t.exit}`} {t.quantity&&`· ×${t.quantity}`}
        </span>
        <span onClick={onToggle} title="Tap to toggle plan followed" className="mono" style={{fontSize:12,cursor:"pointer",color: t.planFollowed?"var(--brass-dim)":"var(--bear)"}}>{t.planFollowed?"on plan ✓":"off plan ✗"}</span>
      </div>
      {t.notes && <div style={{fontSize:13.5,color:"var(--dim)",marginTop:7,lineHeight:1.5}}>{t.notes}</div>}
      {t.img && <img src={t.img} alt="chart" style={{marginTop:8,maxWidth:"100%",maxHeight:200,borderRadius:8,border:"1px solid var(--line2)",display:"block"}}/>}
      <button onClick={()=>setChat(c=>!c)} className="mono"
        style={{marginTop:9,background:"transparent",border:"1px solid var(--line2)",color:chat?"var(--brass)":"var(--focus)",borderRadius:8,padding:"6px 11px",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
        {chat?"▾ Close chat":"💬 Ask about this trade · attach a screenshot"}
      </button>
      {chat &&
        <div style={{marginTop:10,padding:12,background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:11}}>
          <ChatBox storageKey={"tradechat:"+t.id} system={buildTradeSystem(t)}
            placeholder="Ask about this trade…"
            starters={["Grade this trade's structure","What should I have done differently?","What did I do right?"]}
            intro={`Let's review your ${t.ticker} ${t.instrument==="Option"?(t.optType||""):""} trade. Ask me anything, or 📎 attach the chart/screenshot and I'll read it against the setup.`}/>
        </div>}
    </div>
  );
}

/* ============================ WATCHLIST ============================ */
function LinkBar({sym,size="sm"}){
  const L=linksFor(sym);
  const st={fontFamily:"'JetBrains Mono',monospace",fontSize:size==="sm"?10.5:12,fontWeight:600,padding:size==="sm"?"3px 7px":"5px 10px",borderRadius:6,border:"1px solid var(--line2)",textDecoration:"none",whiteSpace:"nowrap"};
  const stop=e=>e.stopPropagation();
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      <a href={L.tv} target="_blank" rel="noopener" onClick={stop} style={{...st,color:"var(--focus)"}}>Chart</a>
      <a href={L.rh} target="_blank" rel="noopener" onClick={stop} style={{...st,color:"var(--dim)"}}>RH</a>
      <a href={L.wb} target="_blank" rel="noopener" onClick={stop} style={{...st,color:"var(--dim)"}}>WB</a>
    </div>
  );
}

const SECTORS=[
  {sym:"XLK",name:"Technology"},
  {sym:"XLV",name:"Health Care"},
  {sym:"XLF",name:"Financials"},
  {sym:"XLY",name:"Consumer Discretionary"},
  {sym:"XLP",name:"Consumer Staples"},
  {sym:"XLE",name:"Energy"},
  {sym:"XLI",name:"Industrials"},
  {sym:"XLB",name:"Materials"},
  {sym:"XLU",name:"Utilities"},
  {sym:"XLRE",name:"Real Estate"},
  {sym:"XLC",name:"Communication Svcs"},
];
const CHART_TF=[["5","5m"],["15","15m"],["30","30m"],["60","1H"],["D","Daily"],["W","Weekly"],["M","Monthly"]];
function canEmbed(){
  try{ const h=(window.location&&window.location.hostname)||""; return !!h && !/claude|anthropic|usercontent|sandbox|localhost|^$/i.test(h); }catch(e){ return false; }
}
function LiveChart({sym}){
  const [tf,setTf]=useState("D");
  const embed=canEmbed();
  useEffect(()=>{ setTf("D"); },[sym]);
  const L=linksFor(sym,tf);
  const src=`https://s.tradingview.com/widgetembed/?frameElementId=tv_${sym}&symbol=${encodeURIComponent(sym)}&interval=${tf}&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hide_side_toolbar=0&allow_symbol_change=1&save_image=0&studies=%5B%5D&hideideas=1`;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
        <div style={{display:"flex",flexWrap:"wrap",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9,padding:3,gap:2}}>
          {CHART_TF.map(([v,l])=>(
            <button key={v} onClick={()=>setTf(v)} className="mono"
              style={{border:"none",padding:"6px 10px",fontSize:13.5,fontWeight:700,borderRadius:6,cursor:"pointer",
                background:tf===v?"var(--bg3)":"transparent",color:tf===v?"var(--brass)":"var(--dim)"}}>{l}</button>
          ))}
        </div>
        <a href={L.tv} target="_blank" rel="noopener" className="mono" style={{fontSize:13.5,fontWeight:600,color:"var(--focus)",textDecoration:"none",border:"1px solid var(--focus)",borderRadius:8,padding:"7px 12px"}}>Open full ↗</a>
      </div>
      {embed
        ? <div style={{borderRadius:12,overflow:"hidden",border:"1px solid var(--line2)",background:"#0b0e12",height:400}}>
            <iframe key={sym+tf} src={src} title={sym+" chart"} allowFullScreen style={{width:"100%",height:"100%",border:"none",display:"block"}}/>
          </div>
        : <a href={L.tv} target="_blank" rel="noopener" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,textAlign:"center",textDecoration:"none",borderRadius:12,border:"1px solid var(--line2)",background:"var(--bg)",padding:"48px 24px"}}>
            <span className="disp" style={{fontSize:18,fontWeight:800,color:"var(--bone)"}}>{sym} — {CHART_TF.find(x=>x[0]===tf)[1]} chart</span>
            <span style={{fontSize:14,color:"var(--dim)",maxWidth:320,lineHeight:1.55}}>The live embedded chart turns on automatically once the app is hosted. In this preview, tap to open the full zoomable TradingView chart ↗</span>
            <span className="btn-primary btn" style={{marginTop:2}}>Open {sym} on TradingView ↗</span>
          </a>}
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:8,lineHeight:1.5}}>Live TradingView chart — 5m / 15m / 30m / 1H / Daily / Weekly / Monthly. Renders inline when hosted; “Open full” for the zoomable chart anytime.</div>
    </div>
  );
}

function Sectors({quotes,setQuotes}){
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [sel,setSel]=useState("XLK");

  useEffect(()=>{ sync(); },[]); // free auto-load sector prices on open (no AI)
  async function sync(){
    setLoading(true); setErr("");
    try{
      const syms=[...SECTORS.map(s=>s.sym),"SPY"];
      const r=await fetch(`/api/quotes?symbols=${encodeURIComponent(syms.join(","))}`);
      const j=await r.json().catch(()=>null);
      if(j&&j.quotes&&typeof j.quotes==="object") setQuotes(q=>({...q,...j.quotes}));
      else setErr((j&&j.error)||"Couldn't load sector quotes — try again.");
    }catch(e){ setErr("Quote sync failed. Check connection and retry."); }
    setLoading(false);
  }

  const spy=quotes.SPY?.changePct;
  const rows=SECTORS.map(s=>({...s,pct:quotes[s.sym]?.changePct}));
  const have=rows.some(r=>r.pct!=null);
  rows.sort((a,b)=>(b.pct==null?-999:b.pct)-(a.pct==null?-999:a.pct));
  const maxAbs=Math.max(1,...rows.map(r=>Math.abs(r.pct||0)));
  const tiny={fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,fontWeight:600,textDecoration:"none",color:"var(--dim)"};

  const L=linksFor(sel);
  const selName=(SECTORS.find(s=>s.sym===sel)||{}).name||"";
  const sq=quotes[sel]; const spct=sq?.changePct;
  const scol=spct==null?"var(--dim)":spct>=0?"var(--bull)":"var(--bear)";
  const openA={fontFamily:"'JetBrains Mono',monospace",fontSize:13.5,fontWeight:600,padding:"8px 12px",borderRadius:9,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,border:"1px solid var(--line2)"};

  return (
    <div>
      {/* Chart panel */}
      <div className="card" style={{padding:18,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0}}>Chart the sector</div><Help text="Pull up the chart for any sector ETF to see its trend and structure. Use it with the sector board above: a leading sector that's also trending is where the cleanest long setups tend to be (and vice versa for shorts)."/></div>
            <div style={{display:"flex",alignItems:"baseline",gap:11,flexWrap:"wrap"}}>
              <span className="mono disp" style={{fontSize:26,fontWeight:800}}>{sel}</span>
              <span style={{fontSize:15.5,color:"var(--dim)"}}>{selName}</span>
              <span className="mono" style={{fontSize:15.5,fontWeight:600,color:scol}}>{spct==null?"":(spct>=0?"+":"")+spct.toFixed(2)+"%"}</span>
            </div>
          </div>
          <div style={{display:"flex",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9,padding:3,visibility:"hidden"}}/>
        </div>

        <div style={{marginTop:14}}><LiveChart sym={sel}/></div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14,alignItems:"center"}}>
          <a href={L.rh} target="_blank" rel="noopener" style={{...openA,color:"var(--bone)"}}>Robinhood ↗</a>
          <a href={L.wb} target="_blank" rel="noopener" style={{...openA,color:"var(--bone)"}}>Webull ↗</a>
          <a href={L.rhOpt} target="_blank" rel="noopener" style={{...openA,color:"#0E1116",background:"var(--bull)",borderColor:"var(--bull)"}}>▲ Calls</a>
          <a href={L.rhOpt} target="_blank" rel="noopener" style={{...openA,color:"#0E1116",background:"var(--bear)",borderColor:"var(--bear)"}}>▼ Puts</a>
        </div>
      </div>

      {/* Board */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12,marginBottom:14}}>
        <div>
          <div className="eyebrow" style={{marginBottom:4}}>Follow the rotation</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:0,fontSize:20,fontWeight:800}}>Sector board</h3><Help text="Ranks the 11 SPDR sector ETFs by today's move — leaders on top, laggards at the bottom. That's your rotation read: money flowing INTO a sector tells you where the strong setups are and whether risk is on or off. Tap Sync to update."/></div>
          <div className="mono" style={{fontSize:13,color:"var(--dim)",marginTop:4}}>
            Benchmark SPY: <span style={{color: spy==null?"var(--faint)": spy>=0?"var(--bull)":"var(--bear)"}}>{spy==null?"— sync to load":(spy>=0?"+":"")+spy.toFixed(2)+"%"}</span>
          </div>
        </div>
        <button className="btn-primary btn" onClick={sync} disabled={loading}>{loading?<span className="spin"/>:"Sync sectors"}</button>
      </div>
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginBottom:10}}>{err}</div>}

      {!have && !loading &&
        <div className="card" style={{padding:28,textAlign:"center",marginBottom:14}}>
          <p style={{margin:0,color:"var(--dim)",fontSize:15}}>Sync to rank all 11 SPDR sectors by today's move. Leaders rise to the top, laggards sink — that's your rotation read for which names to hunt. Quotes are best-effort / delayed.</p>
        </div>}

      <div className="card" style={{padding:"6px 18px"}}>
        {rows.map((r,i)=>{
          const col = r.pct==null?"var(--dim)": r.pct>=0?"var(--bull)":"var(--bear)";
          const w = r.pct==null?0: Math.abs(r.pct)/maxAbs*50;
          const RL=linksFor(r.sym);
          const active=r.sym===sel;
          return (
            <div key={r.sym} onClick={()=>setSel(r.sym)}
              style={{display:"grid",gridTemplateColumns:"22px minmax(0,168px) 1fr 96px",gap:12,alignItems:"center",padding:"11px 10px",margin:"0 -10px",cursor:"pointer",
                borderBottom:i<rows.length-1?"1px solid var(--line)":"none",
                background:active?"rgba(227,168,87,0.07)":"transparent",
                boxShadow:active?"inset 2px 0 0 var(--brass)":"none"}}>
              <div className="mono" style={{fontSize:13.5,color:"var(--faint)",textAlign:"center"}}>{i+1}</div>
              <div style={{minWidth:0}}>
                <span className="mono" style={{fontSize:15.5,fontWeight:700,color:active?"var(--brass)":"var(--bone)"}}>{r.sym}</span>
                <div style={{fontSize:12.5,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
              </div>
              <div style={{position:"relative",height:12,background:"var(--bg)",borderRadius:6}}>
                <div style={{position:"absolute",top:0,bottom:0,left:"50%",width:1,background:"var(--line2)"}}/>
                {r.pct!=null && <div style={{position:"absolute",top:2,bottom:2,left:r.pct>=0?"50%":`calc(50% - ${w}%)`,width:w+"%",background:col,borderRadius:3,opacity:.85}}/>}
              </div>
              <div style={{textAlign:"right"}}>
                <div className="mono" style={{fontSize:15,fontWeight:700,color:col}}>{r.pct==null?"—":(r.pct>=0?"+":"")+r.pct.toFixed(2)+"%"}</div>
                <div style={{display:"flex",gap:7,justifyContent:"flex-end",marginTop:3}}>
                  <a href={RL.rh} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={tiny}>RH</a>
                  <a href={RL.wb} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={tiny}>WB</a>
                  <a href={RL.rhOpt} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{...tiny,color:"var(--brass-dim)"}}>⛓</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mono" style={{fontSize:12.5,color:"var(--faint)",marginTop:12,lineHeight:1.5}}>
        Tap any sector to load its chart above. Green above center = up on the day; bar length is relative to the biggest mover. Sectors above SPY are leading the tape.
      </div>
    </div>
  );
}

const INTEL_SYS="You are an equity research assistant. For the given ticker, search the web and return ONLY a JSON object (no prose, no markdown fences): {\"profile\":\"one-sentence description of the company or ETF\",\"holders\":[{\"name\":\"holder\",\"stake\":\"approx % or share count, note the 13F filing quarter\",\"note\":\"one short sentence on who they are\",\"news\":\"the LATEST concrete move by THIS holder with NUMBERS — direction (added/reduced/new/exited), share count or % change, dollar value if known, and the quarter/date. e.g. 'Added 2.4M shares (+18%) in Q2 2026, ~$690M' or 'Cut position 12% to 5.1M shares Q1 2026'. If no specific filed change is found, say 'No reported change last filing' — never vague.\"}],\"news\":[{\"headline\":\"rewritten in your own words\",\"summary\":\"one short sentence WITH numbers where relevant\",\"when\":\"relative time\"}]}. holders = the 3-5 LARGEST institutional holders / buyers from the latest 13F filings; for an ETF, give the issuer and its largest institutional holders. news = 2-3 most recent, most market-moving items for the ticker. Prefer hard numbers (shares, %, $) over adjectives everywhere.";
function FlowTiming({sym}){
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState("");
  useEffect(()=>{ setData(null); setErr(""); },[sym]);
  async function load(){
    if(loading) return; setLoading(true); setErr("");
    try{
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — Intraday options TIMING for ${sym}. Search for any published or well-known time-of-day options-flow patterns: the hour when CALL activity/volume tends to PEAK (bullish lean, often the open drive), and the hour when PUT activity tends to peak / price tends to soften (often into the afternoon/close). Use real published data where available; otherwise give the well-known general market tendency and set "sourced":false. Return ONLY JSON, no prose or fences: {"callPeak":"e.g. ~10:00 AM ET","putPeak":"e.g. ~3:00 PM ET","note":"one blunt line on the intraday lean and how a day-trader uses it","sourced":true|false}. Never fabricate precise live flow — if it's a general tendency, sourced:false.`);
      const res=await callClaude({ maxTokens:600, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Intraday call/put timing peaks for ${sym}. Today is ${todayISO()}.`}] });
      const j=extractJson(getText(res));
      if(j&&(j.callPeak||j.putPeak)){ setData(j); } else setErr("Couldn't load timing — try again.");
    }catch(e){ setErr(aiErr(e,"Timing load")); }
    setLoading(false);
  }
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0}}>Intraday flow timing</div><Help align="left" text="The time of day CALL activity tends to peak (bullish drive, often the open) and when PUT activity peaks / price softens (often the afternoon). Use it to time entries — buy calls into strength early, watch for the afternoon put lean. Published data where available, otherwise a general market tendency (labeled). Not live flow — confirm on your own tool."/></div>
        <button className="btn" style={{marginLeft:"auto",fontSize:13,padding:"6px 11px"}} onClick={load} disabled={loading}>{loading?<span className="spin"/>:(data?"Refresh":`Load ${sym} timing`)}</button>
      </div>
      {err && <div style={{color:"var(--bear)",fontSize:13.5}}>{err}</div>}
      {data &&
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{padding:"12px 13px",background:"rgba(63,183,130,0.06)",border:"1px solid var(--bull)",borderRadius:11}}>
              <div className="eyebrow" style={{marginBottom:5,color:"var(--bull)"}}>📈 Calls peak</div>
              <div className="mono" style={{fontSize:16,fontWeight:800,color:"var(--bull)"}}>{data.callPeak||"—"}</div>
            </div>
            <div style={{padding:"12px 13px",background:"rgba(231,106,91,0.06)",border:"1px solid var(--bear)",borderRadius:11}}>
              <div className="eyebrow" style={{marginBottom:5,color:"var(--bear)"}}>📉 Puts peak</div>
              <div className="mono" style={{fontSize:16,fontWeight:800,color:"var(--bear)"}}>{data.putPeak||"—"}</div>
            </div>
          </div>
          {data.note && <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.55,marginTop:9}}>{data.note}</div>}
          <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:7}}>{data.sourced?"From published data":"General market tendency (estimate)"} · not live flow — confirm on your own tool.</div>
        </div>}
    </div>
  );
}
function DeepDive({sym:fixedSym,allowInput}){
  const [sym,setSym]=useState(fixedSym||"");
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState(""); const [time,setTime]=useState(null); const [open,setOpen]=useState(false);
  useEffect(()=>{ if(fixedSym){ setSym(fixedSym); setData(null); setOpen(false); } },[fixedSym]);
  async function run(){
    const s=(sym||"").trim().toUpperCase(); if(!s||loading) return;
    setOpen(true); setLoading(true); setErr(""); setData(null);
    try{
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — DEEP DIVE on ${s}. Search the web for: (1) the largest institutional holders' latest 13F MOVES with hard numbers (added/cut/new/exited — shares, %, $, quarter); (2) the most recent price-moving news; (3) any published or well-known INTRADAY options-flow / time-of-day patterns for ${s} (e.g. when call vs put volume peaks by hour, morning vs afternoon behavior) — use real published data where available, otherwise give general known patterns and clearly LABEL them "general estimate"; never fabricate precise live flow. Then, grounded in my Strat/ICT system, my bias, and how the top holders are positioned, give an educated thesis. Return ONLY JSON, no prose or fences:
{"bias":"Bullish|Bearish|Neutral","confidence":"low|medium|high — plus a few words why","holderFlow":"net institutional read WITH numbers — who's adding/cutting and the aggregate lean","newsRead":"what the recent news means for direction, with numbers where possible","timing":[{"window":"e.g. 9:30–10:00 ET","pattern":"what tends to happen then","note":"call/put lean or volume note — label 'general estimate' if not sourced"}],"thesis":"what you think likely results and WHY, tied to structure/FTFC/levels — probability, not prophecy","marketImpact":"how this ripples to the broader market, small caps, and correlated names","entry":"best entry window/condition + the trigger to wait for","exit":"best exit window/condition to take profit or bail","invalidation":"the level or condition that makes this thesis wrong"}
Be blunt and specific; prefer numbers over adjectives.`);
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Deep dive on ${s}. Today is ${todayISO()}.`}] });
      const j=extractJson(getText(res));
      if(j&&(j.thesis||j.holderFlow||j.bias||j.newsRead||j.marketImpact)){ setData(j); setTime(Date.now()); } else setErr("Couldn't complete the deep dive — tap Re-run to try again.");
    }catch(e){ setErr(aiErr(e,"Deep dive")); }
    setLoading(false);
  }
  const bias=(data&&data.bias)||""; const bl=/bear/i.test(bias), bu=/bull/i.test(bias);
  const bcol=bu?"var(--bull)":bl?"var(--bear)":"var(--dim)";
  const Sec=({label,children})=> children?<div style={{marginBottom:12}}><div className="eyebrow" style={{marginBottom:5}}>{label}</div><div style={{fontSize:14,color:"var(--bone)",lineHeight:1.6}}>{children}</div></div>:null;
  return (
    <div style={{marginTop:12,padding:"14px 15px",background:"var(--bg2)",border:"1px solid var(--brass-dim)",borderRadius:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0}}>🔍 Deep dive</div><Help align="left" text="A full institutional-flow + news + timing analysis, run through your trading system, ending in a thesis with entry/exit windows and an invalidation level. Holder moves are from 13F filings (quarterly, delayed). Intraday timing patterns use published data where it exists and are labeled 'general estimate' otherwise — confirm live flow on your own tool. Educational, not a signal."/></div>
        {allowInput && <input value={sym} onChange={e=>setSym(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter")run();}} placeholder="TICKER" className="mono" style={{width:90,background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--brass)",borderRadius:7,padding:"6px 9px",fontSize:13.5,fontWeight:700,outline:"none",textTransform:"uppercase"}}/>}
        <button className="btn-primary btn" style={{marginLeft:"auto"}} onClick={run} disabled={loading||!(sym||"").trim()}>{loading?<span className="spin"/>:(data?"Re-run":`Deep dive${fixedSym?" "+fixedSym:""}`)}</button>
      </div>
      {err && <div style={{color:"var(--bear)",fontSize:13.5}}>{err}</div>}
      {loading && !data && <div className="mono" style={{fontSize:12.5,color:"var(--dim)"}}>Digging into holders, news, flow & structure…</div>}
      {data && open &&
        <div style={{marginTop:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <span className="mono" style={{fontSize:14.5,fontWeight:800,color:bcol,padding:"4px 12px",borderRadius:7,border:"1px solid "+bcol}}>{bias||"—"} {bu?"▲":bl?"▼":""}</span>
            {data.confidence && <span className="mono" style={{fontSize:12.5,color:"var(--dim)"}}>confidence: {data.confidence}</span>}
          </div>
          <Sec label="Institutional flow">{data.holderFlow}</Sec>
          <Sec label="What the news means">{data.newsRead}</Sec>
          {Array.isArray(data.timing)&&data.timing.length>0 &&
            <div style={{marginBottom:12}}>
              <div className="eyebrow" style={{marginBottom:6}}>Intraday timing patterns</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {data.timing.map((t,i)=>(
                  <div key={i} style={{padding:"8px 11px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9}}>
                    <div style={{display:"flex",gap:8,alignItems:"baseline",flexWrap:"wrap"}}><span className="mono" style={{fontSize:13,fontWeight:800,color:"var(--brass)"}}>{t.window}</span><span style={{fontSize:13.5,color:"var(--bone)"}}>{t.pattern}</span></div>
                    {t.note && <div style={{fontSize:12.5,color:"var(--dim)",marginTop:3,lineHeight:1.5}}>{t.note}</div>}
                  </div>
                ))}
              </div>
            </div>}
          <Sec label="Thesis — what likely results">{data.thesis}</Sec>
          <Sec label="Market impact / ripple">{data.marketImpact}</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            {data.entry && <div style={{padding:"10px 12px",background:"rgba(63,183,130,0.06)",border:"1px solid var(--bull)",borderRadius:10}}><div className="eyebrow" style={{marginBottom:4,color:"var(--bull)"}}>Best entry</div><div style={{fontSize:13.5,color:"var(--bone)",lineHeight:1.5}}>{data.entry}</div></div>}
            {data.exit && <div style={{padding:"10px 12px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:10}}><div className="eyebrow" style={{marginBottom:4,color:"var(--brass)"}}>Best exit</div><div style={{fontSize:13.5,color:"var(--bone)",lineHeight:1.5}}>{data.exit}</div></div>}
          </div>
          {data.invalidation && <div style={{padding:"9px 12px",background:"rgba(231,106,91,0.06)",border:"1px solid var(--bear)",borderRadius:10,marginBottom:8}}><span className="mono" style={{fontSize:11.5,color:"var(--bear)",fontWeight:800}}>WRONG IF </span><span style={{fontSize:13.5,color:"var(--bone)"}}>{data.invalidation}</span></div>}
          <div className="mono" style={{fontSize:11.5,color:"var(--faint)",lineHeight:1.5}}>Deep dive{time?` · ${new Date(time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:""} — 13F data is delayed/quarterly; timing patterns are estimates unless sourced. Educational, not a signal — confirm live and wait for your trigger.</div>
        </div>}
    </div>
  );
}
const FALLBACK_INTEL={
  IWM:{profile:"iShares Russell 2000 ETF (BlackRock) — ~2,000 U.S. small-caps, the dominant, most-liquid small-cap vehicle (~$82B AUM, 0.19% fee).",holders:[
    {name:"BlackRock / iShares (Issuer)",stake:"Fund sponsor",note:"IWM's ETF issuer and largest beneficial owner via the iShares platform.",news:""},
    {name:"Goldman Sachs Group Inc.",stake:"Top 13F position",note:"Consistently a top institutional holder by share count across recent filings.",news:""},
    {name:"Bank of America Corp",stake:"Top-5 holder",note:"Major broker-dealer holding IWM across client and prop accounts.",news:""},
    {name:"Jane Street Group LLC",stake:"Top-5 holder",note:"HFT market-maker that routinely holds large ETF positions for arbitrage/hedging.",news:""},
    {name:"Citadel / Millennium",stake:"Top-10 holders",note:"Multi-strategy hedge funds using IWM for hedging, pairs trades, small-cap exposure.",news:""},
  ]},
  SPY:{profile:"SPDR S&P 500 ETF (State Street) — the most-traded ETF in the world, tracking the S&P 500 large-caps.",holders:[
    {name:"State Street (Issuer)",stake:"Fund sponsor",note:"SPY's issuer via SSGA.",news:""},
    {name:"BlackRock",stake:"Top holder",note:"Large institutional position across funds.",news:""},
    {name:"Bank of America / Morgan Stanley",stake:"Top-5 holders",note:"Broker-dealers holding across client and prop books.",news:""},
    {name:"Citadel / Susquehanna",stake:"Top-10 holders",note:"Market-makers and multi-strats using SPY for hedging and flow.",news:""},
  ]},
  QQQ:{profile:"Invesco QQQ Trust — tracks the Nasdaq-100, tech/AI-heavy large-caps.",holders:[
    {name:"Invesco (Issuer)",stake:"Fund sponsor",note:"QQQ's issuer.",news:""},
    {name:"BlackRock / Vanguard",stake:"Top holders",note:"Large institutional positions.",news:""},
    {name:"Citadel / Jane Street",stake:"Top-10 holders",note:"Market-makers holding for arbitrage and hedging.",news:""},
  ]},
};
function TickerIntel({sym}){
  const [data,setData]=useState(null);
  const [ts,setTs]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  useEffect(()=>{(async()=>{ const s=await sGet("intel:"+sym); if(s&&s.data){ setData(s.data); setTs(s.ts||null); } else if(FALLBACK_INTEL[sym]){ setData({...FALLBACK_INTEL[sym],fallback:true}); setTs(null); } else { setData(null); setTs(null); } setErr(""); })();},[sym]);
  async function dig(){
    setLoading(true); setErr("");
    try{
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}],
        system:INTEL_SYS,
        messages:[{role:"user",content:`Ticker: ${sym}. Largest holders/buyers, a short profile, and the latest news. Today is ${todayISO()}.`}]});
      const j=extractJson(getText(res));
      if(j){ setData(j); const now=Date.now(); setTs(now); await sSet("intel:"+sym,{data:j,ts:now}); }
      else if(FALLBACK_INTEL[sym]){ setData({...FALLBACK_INTEL[sym],fallback:true}); }
      else setErr("Couldn't parse the intel — try again.");
    }catch(e){ if(FALLBACK_INTEL[sym]){ setData({...FALLBACK_INTEL[sym],fallback:true}); } else setErr(aiErr(e,"Intel")); }
    setLoading(false);
  }
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
        <div><div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow">Ticker intel</div><Help text="Tap 'Dig in' to pull who's really behind this ticker — its largest institutional holders from 13F filings (quarterly, delayed) — plus a quick profile and the latest news. Saved as a note per ticker. Verify before trading on it."/></div><div style={{fontSize:14,color:"var(--dim)"}}>Largest holders · profile · news</div></div>
        <button className="btn-primary btn" onClick={dig} disabled={loading}>{loading?<span className="spin"/>:(data?"Refresh":"Dig in")}</button>
      </div>
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginBottom:8}}>{err}</div>}
      {!data && !loading &&
        <p style={{margin:0,fontSize:14,color:"var(--dim)",lineHeight:1.55}}>Pull {sym}'s largest institutional holders (who's really buying), a quick profile, and the latest news — saved here as a note. Holdings come from 13F filings (quarterly, delayed); confirm before trading on any of it.</p>}
      {data &&
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {data.profile && <div style={{fontSize:14.5,color:"var(--bone)",lineHeight:1.55}}>{data.profile}</div>}
          {data.fallback && <div className="mono" style={{fontSize:11.5,color:"var(--brass-dim)",marginBottom:8}}>Reference holders (static) — tap Dig in / Refresh for live 13F data + news.</div>}
          {Array.isArray(data.holders)&&data.holders.length>0 &&
            <div>
              <div className="eyebrow" style={{marginBottom:8}}>Largest holders / buyers</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.holders.map((h,i)=>(
                  <div key={i} style={{padding:"9px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline"}}>
                      <span className="disp" style={{fontSize:15,fontWeight:700,color:"var(--bone)"}}>{h.name}</span>
                      <span className="mono" style={{fontSize:12.5,color:"var(--brass)",whiteSpace:"nowrap"}}>{h.stake}</span>
                    </div>
                    {h.note && <div style={{fontSize:13.5,color:"var(--dim)",marginTop:3,lineHeight:1.5}}>{h.note}</div>}
                    {h.news && <div style={{fontSize:13,color:"var(--focus)",marginTop:5,lineHeight:1.5,paddingLeft:9,borderLeft:"2px solid var(--brass-dim)"}}>📰 {h.news}</div>}
                  </div>
                ))}
              </div>
            </div>}
          {Array.isArray(data.news)&&data.news.length>0 &&
            <div>
              <div className="eyebrow" style={{marginBottom:8}}>Latest news</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.news.map((n,i)=>(
                  <div key={i} style={{padding:"9px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline"}}>
                      <span className="disp" style={{fontSize:14.5,fontWeight:600,color:"var(--bone)",lineHeight:1.3}}>{n.headline}</span>
                      <span className="mono" style={{fontSize:11.5,color:"var(--faint)",whiteSpace:"nowrap"}}>{n.when}</span>
                    </div>
                    {n.summary && <div style={{fontSize:13.5,color:"var(--dim)",marginTop:3,lineHeight:1.5}}>{n.summary}</div>}
                  </div>
                ))}
              </div>
            </div>}
          {ts && <div className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>Saved {new Date(ts).toLocaleString()} · 13F holdings are delayed/quarterly · verify before trading.</div>}
        </div>}
      <DeepDive sym={sym}/>
    </div>
  );
}

const DEFS={
  strike:"The price the option locks in — a call lets you buy, a put lets you sell the stock there. Near-money strikes move most with price.",
  delta:"How much the option moves per $1 move in the stock, and roughly its chance of finishing in-the-money. 0.60 ≈ moves $0.60 and ~60% odds. You want 0.55–0.70.",
  dte:"Days to expiration. Fewer days = faster time (theta) decay. Use 3–5 DTE for day trades, 30–45 for swings so time isn't fighting you.",
  trigger:"The exact signal that puts you in — a 2-up / 2-down break of the prior bar. No trigger, no trade.",
  stop:"Your pre-set exit if wrong — max 40–50% premium loss, written at entry. Zero is never the stop.",
  targets:"Where you take profit in pieces (scale out) — T1/T2/T3 at the next pivots, banking into strength.",
  resistance:"A price ceiling where sellers tend to step in and stall or reverse an up-move.",
  support:"A price floor where buyers tend to step in and stall or reverse a down-move.",
  volume:"How many shares/contracts trade. Expansion confirms a move, contraction warns it's weak, a climax bar can mark exhaustion.",
  liquidity:"How easily you get in and out — high open interest & volume with a tight bid-ask means clean fills and easy scaling.",
  iv:"Implied volatility — the market's expected move priced into the option. High IV = expensive premium and IV-crush risk after an event; you can be right on direction and still lose.",
};
function Term({label,def,color}){
  const [o,setO]=useState(false);
  return (
    <span style={{position:"relative",display:"inline-flex",alignItems:"center",gap:3}}>
      <span className="eyebrow" style={{margin:0,color:color||undefined}}>{label}</span>
      <button onClick={()=>setO(v=>!v)} title={"What is "+label+"?"} style={{width:13,height:13,borderRadius:"50%",border:"1px solid var(--line2)",background:o?"var(--brass)":"transparent",color:o?"#241A0A":"var(--faint)",fontSize:11,fontWeight:800,cursor:"pointer",lineHeight:1,padding:0,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>?</button>
      {o && <span style={{position:"absolute",top:18,left:0,zIndex:70,width:210,maxWidth:"72vw",padding:"9px 11px",background:"var(--bg3)",border:"1px solid var(--line2)",borderRadius:9,fontSize:12.5,lineHeight:1.5,color:"var(--dim)",boxShadow:"0 8px 24px rgba(0,0,0,0.55)",fontFamily:"'Inter',sans-serif",fontWeight:400,letterSpacing:0,textTransform:"none"}}>{def}</span>}
    </span>
  );
}
function BothSidesScanner({sym,onScan}){
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState("");
  async function scan(){
    if(loading) return; setLoading(true); setErr("");
    try{
      const sys=await withKB(MENTOR_SYS+`\n\nTASK — Build a complete TWO-SIDED options plan for ${sym} so I'm ready whichever way it breaks. Search for its latest price AND a sense of its implied volatility / any earnings or macro catalyst. HONESTY: today is ${todayISO()} — if the US market is closed, say so and label the price "last close — verify"; never invent an intraday session. Deltas and premiums are ESTIMATES from price — tell me to confirm on the live chain. Return ONLY JSON, no prose/fences:
{"price":"last price + open/closed note",
 "bull":{"trigger":"level/2-up that turns me bullish","strike":"call strike (near-money per my rules)","moneyness":"ITM/OTM by $X vs price (or ATM)","theta":"≈ −$X/contract/day","delta":"~0.xx","dte":"e.g. 3–5 DTE day / 30–45 swing","stop":"max 40–50% loss","targets":"T1 → T2 → T3","calc":{"entry":<estimated option premium to pay, a number like 1.05>,"bid":<est bid #>,"ask":<est ask #>,"target":<estimated premium if T1 hits>,"target2":<premium at T2>,"target3":<premium at T3>,"delta":<delta as a number 0–1>,"entryLevel":<underlying entry/trigger price>,"invalidation":<underlying price where the LONG is wrong>}},
 "bear":{"trigger":"level/2-down that turns me bearish","strike":"put strike","moneyness":"ITM/OTM by $X (or ATM)","theta":"≈ −$X/contract/day","delta":"~0.xx","dte":"","stop":"","targets":"","calc":{"entry":<premium>,"bid":<est bid #>,"ask":<est ask #>,"target":<premium at T1>,"target2":<premium at T2>,"target3":<premium at T3>,"delta":<0–1>,"entryLevel":<underlying entry/trigger>,"invalidation":<underlying price where the SHORT is wrong>}},
 "strategy":"the single best options strategy for current conditions and WHY (e.g. near-money long call/put on the trigger; a debit spread if IV is rich into an event to cut theta/vega; avoid buying premium into a catalyst if IV crush is likely)",
 "market":"the market strategy for ${sym}: bias from structure, any catalyst this week, and how to play it",
 "levels":{"resistance":"nearest key resistance level(s)","support":"nearest key support level(s)"},
 "volume":"is the latest move on expanding (confirms) or contracting (warns) volume — one line",
 "liquidity":"option liquidity at these strikes: open interest / volume / bid-ask spread — can I fill and scale cleanly?",
 "iv":"implied volatility read: is premium rich or cheap, and IV-crush risk into any event this week",
 "active":"which side is NEARER to triggering now, or 'neither — no trade, wait'",
 "note":"one blunt discipline line"}
Strikes MUST be near-money per my rules (ATM or one ITM, delta 0.55–0.70), never far-OTM lottos, and every long option needs a stop. Do NOT encourage forcing trades or trading many times a day — take only a real trigger and scale out. OUTPUT ONLY the JSON object — no text before or after, no markdown. Keep every value to ONE short line (≤ 16 words) so the whole thing stays compact.`);
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Full two-sided options plan for ${sym}. Today is ${todayISO()}. Reply with ONLY the compact JSON.`}] });
      const j=extractJson(getText(res));
      if(j&&(j.bull||j.bear)){ setData(j); onScan&&onScan(j); logScan("Two-sided", [sym], [{s:String(sym||"").toUpperCase(),note:String(j.bias||j.read||"both sides").slice(0,40)}]); } else setErr("Couldn't build the plan — try again.");
    }catch(e){ setErr(aiErr(e,"Scan")); }
    setLoading(false);
  }
  const branch=(b,label,color,bg)=>(
    <div style={{flex:"1 1 220px",padding:"12px 13px",background:bg,border:"1px solid "+color,borderRadius:11}}>
      <div className="disp" style={{fontSize:15,fontWeight:800,color:color,marginBottom:9}}>{label}</div>
      {b.strike && <div style={{display:"flex",gap:8,marginBottom:8}}>
        <div style={{flex:1}}><div style={{marginBottom:3}}><Term label="Strike" def={DEFS.strike}/></div><span className="mono" style={{fontSize:15.5,fontWeight:800,color:color}}>{b.strike}</span></div>
        <div style={{flex:1}}><div style={{marginBottom:3}}><Term label="Delta" def={DEFS.delta}/></div><span className="mono" style={{fontSize:15.5,fontWeight:800,color:"var(--bone)"}}>{b.delta||"—"}</span></div>
        <div style={{flex:1}}><div style={{marginBottom:3}}><Term label="DTE" def={DEFS.dte}/></div><span className="mono" style={{fontSize:14,fontWeight:700,color:"var(--bone)"}}>{b.dte||"—"}</span></div>
      </div>}
      {[["Trigger",b.trigger,"trigger"],["Stop",b.stop,"stop"],["Targets",b.targets,"targets"]].map(([k,v,dk])=> v?(
        <div key={k} style={{marginBottom:6}}><div style={{marginBottom:2}}><Term label={k} def={DEFS[dk]}/></div><span style={{fontSize:13.5,color:"var(--bone)",lineHeight:1.45}}>{v}</span></div>
      ):null)}
    </div>
  );
  const box=(label,text,color)=>(
    <div style={{marginTop:10,padding:"11px 13px",background:"var(--bg)",border:"1px solid "+(color||"var(--line2)"),borderRadius:10}}>
      <span className="eyebrow" style={{display:"block",marginBottom:5,color:color||"var(--brass)"}}>{label}</span>
      <span style={{fontSize:14,color:"var(--bone)",lineHeight:1.55}}>{text}</span>
    </div>
  );
  const tile=(label,text,color,defKey)=> text?(
    <div style={{padding:"9px 11px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9}}>
      <div style={{marginBottom:4}}><Term label={label} def={DEFS[defKey]} color={color}/></div>
      <span style={{fontSize:13,color:"var(--bone)",lineHeight:1.45}}>{text}</span>
    </div>
  ):null;
  return (
    <div style={{marginTop:12}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
        <div className="eyebrow" style={{margin:0}}>Two-sided scanner</div>
        <Help align="left" text="Scans the CURRENT market for this ticker (delayed — verify on your broker; stale on weekends) and builds a plan for BOTH directions, so you take whichever actually triggers. Each side shows Strike / Delta / DTE (the contract, per your rules), the Trigger (level that fires it), the Stop (max 40–50% loss), and Targets (scale-out levels). 'Closer now' = which side is nearer to triggering. Then: Resistance & Support (key levels), Volume (is the move confirmed or fading), Liquidity (can you fill & scale that strike), IV (is premium rich/cheap + crush risk), Best options strategy, and Market strategy. Strikes & deltas are estimates — confirm on the live chain. It's a plan, not a signal: wait for a real trigger, size off the stop, scale out."/>
      </div>
      <button className="btn-primary btn" style={{width:"100%"}} onClick={scan} disabled={loading}>{loading?<span className="spin"/>:`🎯 Scan ${sym} — strikes, both sides & strategy`}</button>
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:8}}>{err}</div>}
      {data &&
        <div style={{marginTop:12}}>
          {data.price && <div className="mono" style={{fontSize:13,color:"var(--dim)",marginBottom:10}}>{data.price}</div>}
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {data.bull && branch(data.bull,"▲ Bullish — Calls","var(--bull)","rgba(63,183,130,0.06)")}
            {data.bear && branch(data.bear,"▼ Bearish — Puts","var(--bear)","rgba(231,106,91,0.06)")}
          </div>
          {data.active && <div style={{marginTop:10,padding:"10px 13px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:10,fontSize:14,color:"var(--bone)"}}><b style={{color:"var(--brass)"}}>Closer now:</b> {data.active}</div>}
          {(data.levels||data.volume||data.liquidity||data.iv) &&
            <div style={{marginTop:10,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:8}}>
              {tile("Resistance",data.levels&&data.levels.resistance,"var(--bear)","resistance")}
              {tile("Support",data.levels&&data.levels.support,"var(--bull)","support")}
              {tile("Volume",data.volume,"var(--focus)","volume")}
              {tile("Liquidity",data.liquidity,"var(--brass)","liquidity")}
              {tile("Implied vol (IV)",data.iv,"var(--brass)","iv")}
            </div>}
          {data.strategy && box("Best options strategy",data.strategy,"var(--focus)")}
          {data.market && box("Market strategy",data.market,"var(--brass-dim)")}
          {data.note && <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:8,lineHeight:1.5}}>{data.note} · Strikes/deltas are estimates — confirm on the live chain. Take only a real trigger, size off the stop, scale out.</div>}
        </div>}
    </div>
  );
}

const PATTERN_DEFS={
  nirvana:"Nirvana (1-3): an inside bar then an outside bar — price coils tight, then expands violently through both sides. High-energy breakout; trade the side that holds after the outside bar.",
  holy:"Holy Grail (3-1): an outside bar then an inside bar — a broad, volatile range then a tight coil inside it. The break of that inside bar is a clean entry with a small stop.",
  t312:"3-1-2: outside bar → inside bar → directional break. Wide range, then a tight coil, then a clean break out of it — a high-quality entry with a clear stop.",
  t212:"2-1-2: directional bar → inside bar → directional break. The inside bar coils the energy; the break is a defined entry. Same way = continuation, opposite = reversal.",
  t22:"2-2: two directional bars in a row. Same direction = continuation; opposite = a reversal ('2-2 rev'). Read the higher timeframe to know which you want.",
};
function patternDef(p){
  const s=(p||"").toLowerCase();
  if(/nirvana|1-3/.test(s)) return PATTERN_DEFS.nirvana;
  if(/3-1-2/.test(s)) return PATTERN_DEFS.t312;
  if(/2-1-2/.test(s)) return PATTERN_DEFS.t212;
  if(/holy|3-1/.test(s)) return PATTERN_DEFS.holy;
  if(/2-2/.test(s)) return PATTERN_DEFS.t22;
  return "A Strat bar sequence — see the full list in the Playbook glossary.";
}
function rowRead(r){
  const s=[r.d,r.w,r.m,r.q]; const ups=s.filter(x=>x==="u").length, downs=s.filter(x=>x==="d").length;
  let cont;
  if(ups===4) cont="Full up-continuity (FTFC ▲) — all four timeframes bullish. Highest-odds LONG environment; trade with it.";
  else if(downs===4) cont="Full down-continuity (FTFC ▼) — all four timeframes bearish. Highest-odds SHORT environment; puts with the trend.";
  else if((r.d==="u"||r.w==="u")&&(r.m==="d"||r.q==="d")) cont="Short timeframes up, higher ones down — a bounce INSIDE a bigger downtrend. Countertrend: keep it tight, or fade the bounce.";
  else if((r.d==="d"||r.w==="d")&&(r.m==="u"||r.q==="u")) cont="Short timeframes down, higher ones up — a pullback inside a bigger uptrend. Long only on a real reclaim.";
  else cont="Timeframes disagree — a broadening range. Lower odds: trade the edges (the trigger off a level), not continuation, and keep size small.";
  const p=(r.p||"").toLowerCase(); let pat="";
  if(/nirvana|1-3/.test(p)) pat=" Nirvana (1-3): coiled and about to expand — wait for the outside bar to pick a side, then go with it.";
  else if(/3-1-2/.test(p)) pat=" 3-1-2: coiled inside a wide range and just triggered a direction — clean entry, clear stop at the inside bar.";
  else if(/2-1-2/.test(p)) pat=" 2-1-2: a defined break out of an inside bar — same direction continues, opposite reverses.";
  else if(/holy|3-1/.test(p)) pat=" Holy Grail (3-1): a tight coil inside a big range — the inside-bar break is your clean, small-stop entry.";
  else if(/2-2/.test(p)) pat=" 2-2 rev: a two-bar reversal read — watch for the turn to confirm before committing.";
  return cont+pat+" (Estimate — confirm on your chart.)";
}
function PatternTag({p}){
  const [o,setO]=useState(false);
  return (
    <span style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>setO(v=>!v)} style={{fontSize:12,fontWeight:700,padding:"3px 9px",borderRadius:5,background:o?"var(--brass)":"var(--bg3)",border:"1px solid var(--brass-dim)",color:o?"#241A0A":"var(--brass)",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>{p}<span style={{opacity:0.7,fontSize:11.5}}>ⓘ</span></button>
      {o && <span style={{position:"absolute",top:26,left:0,zIndex:70,width:240,maxWidth:"74vw",padding:"10px 12px",background:"var(--bg3)",border:"1px solid var(--line2)",borderRadius:9,fontSize:12.5,lineHeight:1.55,color:"var(--dim)",boxShadow:"0 8px 24px rgba(0,0,0,0.55)",fontWeight:400,textTransform:"none",letterSpacing:0}}>{patternDef(p)}</span>}
    </span>
  );
}
const STRAT_FILTERS=[["all","All"],["nirvana","Nirvana 1-3"],["holy","Holy Grail 3-1"],["ftfcU","FTFC ▲"],["ftfcD","FTFC ▼"]];
/* ============================ RUNNER SCAN — 10-bagger hunter ============================ */
const RUNNER_SYS=`You are an options-runner scout. You hunt setups that CAN produce outsized option returns (5x-10x+). You are NOT predicting; you are grading structure.

A 1000% option move needs FOUR things stacked:
1. COMPRESSION (0-25) — the underlying is coiling. Tight daily ranges vs its own 20-day average, inside days, a narrow multi-day base, contracting volume. Already-extended names score LOW.
2. LEVEL (0-25) — price sits just under (long) or just over (short) a magnet that triggers stops: prior day/week/month high or low, 52-week high, opening-range high, ADR breakout line, round number. Mid-range = LOW.
3. CATALYST (0-25) — something in the next few sessions can force the move: earnings, guidance, product/AI announcement, FDA, index add, analyst day, or Fed/CPI for high-beta names. No catalyst = LOW.
4. FUEL (0-25) — options still cheap for the move that's possible: low-to-mid IV rank AND real liquidity (open interest, tight spreads) so a +1000% contract can actually be SOLD. Rich premium or thin chains score LOW.

Use web_search for current data: latest close, recent range behavior, the real upcoming event calendar, rough IV. Be conservative — most names on most days total 30-50, not 80+.`;

function runnerScore(r){ return (num(r.comp)||0)+(num(r.lvl)||0)+(num(r.cat)||0)+(num(r.fuel)||0); }
function scoreTone(s){ return s>=75?"var(--bull)":s>=55?"var(--brass)":"var(--faint)"; }
function verdictFor(d){
  if(!isFinite(d)||d<=0) return ["—","var(--faint)"];
  if(d<=1.5) return ["Plausible","var(--bull)"];
  if(d<=3) return ["Stretch","var(--brass)"];
  return ["Lottery ticket","var(--bear)"];
}

function ScoreBar({label,v,max=25}){
  const pct=Math.max(0,Math.min(100,(num(v)||0)/max*100));
  return (
    <div style={{marginBottom:7}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,color:"var(--faint)",marginBottom:3,fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>
        <span>{label}</span><span style={{color:"var(--dim)"}}>{(num(v)||0)+"/"+max}</span>
      </div>
      <div style={{height:5,background:"var(--bg)",borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:pct>=70?"var(--bull)":pct>=45?"var(--brass)":"var(--line2)",borderRadius:4}}/>
      </div>
    </div>
  );
}

/* ---------- the math: what the stock must actually DO ---------- */
function TenXMath({seed,watch}){
  const [f,setF]=useState({sym:"",spot:"",strike:"",prem:"",atr:"",dte:"",dir:"Call",budget:""});
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  useEffect(()=>{ if(seed&&seed._t) setF(v=>({...v,...seed})); },[seed&&seed._t]);
  const set=(k,v)=>setF(o=>({...o,[k]:v}));
  /* Auto-fill the free, market-data fields from the ticker: current price
     (quotes) and the average daily range / ATR over ~14 daily bars (ohlc).
     Strike, premium and DTE stay manual — they depend on the contract you pick. */
  async function autofill(){
    const s=String(f.sym||"").trim().toUpperCase(); if(!s||busy) return;
    setBusy(true); setNote("");
    try{
      const [qr,or_]=await Promise.all([
        fetch(`/api/quotes?symbols=${encodeURIComponent(s)}`).then(r=>r.json()).catch(()=>null),
        fetch(`/api/ohlc?symbol=${encodeURIComponent(s)}&interval=1d&range=1mo`).then(r=>r.json()).catch(()=>null),
      ]);
      const q=qr&&qr.quotes&&qr.quotes[s];
      const bars=(or_&&Array.isArray(or_.bars))?or_.bars:[];
      const last=bars.slice(-14);
      const atr=last.length ? last.reduce((a,b)=>a+(b.h-b.l),0)/last.length : null;
      const px=(q&&q.price!=null)?q.price:(bars.length?bars[bars.length-1].c:null);
      setF(o=>({...o, sym:s, spot:px!=null?String(Math.round(px*100)/100):o.spot, atr:atr!=null?String(Math.round(atr*100)/100):o.atr }));
      if(px!=null||atr!=null) setNote(`${s}${px!=null?` @ $${(Math.round(px*100)/100).toFixed(2)}`:""}${atr!=null?` · range $${(Math.round(atr*100)/100).toFixed(2)}`:""}`);
      else setNote("No data — enter the numbers manually.");
    }catch(e){ setNote("Couldn't fetch — enter manually."); }
    setBusy(false);
  }

  const spot=num(f.spot),strike=num(f.strike),prem=num(f.prem),atr=num(f.atr),budget=num(f.budget);
  const isCall=f.dir==="Call";
  const ready=spot>0&&strike>0&&prem>0;
  const lineAt=m=>isCall?strike+m*prem:strike-m*prem;
  const moveOf=p=>Math.abs(p-spot);
  const be=isCall?strike+prem:strike-prem;
  const contracts=(prem>0&&budget>0)?Math.floor(budget/(prem*100)):0;
  const cost=contracts*prem*100;
  const otm=(spot>0&&strike>0)?(isCall?strike-spot:spot-strike):0;
  const rows=[3,5,10].map(m=>{ const p=lineAt(m); const d=atr>0?moveOf(p)/atr:NaN; const [vl,vt]=verdictFor(d);
    return {m,p,mv:moveOf(p),pc:spot?moveOf(p)/spot*100:0,d,vl,vt}; });

  const inp=(label,k,ph,mono=true)=>(
    <div>
      <div style={{fontSize:11.5,color:"var(--faint)",marginBottom:4,fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>{label}</div>
      <input className={mono?"mono":""} value={f[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} style={{padding:"9px 11px",fontSize:14}}/>
    </div>
  );

  return (
    <div className="card" style={{padding:18}}>
      <div className="eyebrow" style={{marginBottom:4}}>The 10x math</div>
      <div className="disp" style={{fontSize:20,fontWeight:700,marginBottom:6}}>What the stock has to actually do</div>
      <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.6,marginBottom:16}}>
        A contract reaches a multiple when its intrinsic value gets there. So for a {isCall?"call":"put"}: <span className="mono" style={{color:"var(--brass)"}}>{isCall?"strike + (multiple × premium)":"strike − (multiple × premium)"}</span>. Type the contract in and you stop hoping — you see the exact price the stock must print.
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(115px,1fr))",gap:10,marginBottom:14}}>
        <div>
          <div style={{fontSize:11.5,color:"var(--faint)",marginBottom:4,fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>Ticker</div>
          <input list="tenx-tickers" value={f.sym} onChange={e=>set("sym",e.target.value)} onBlur={autofill} onKeyDown={e=>{ if(e.key==="Enter") autofill(); }} placeholder="GOOGL" style={{padding:"9px 11px",fontSize:14,width:"100%"}}/>
          <datalist id="tenx-tickers">{(watch||[]).map(s=><option key={s} value={s}/>)}</datalist>
        </div>
        <div>
          <div style={{fontSize:11.5,color:"var(--faint)",marginBottom:4,fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>Side</div>
          <select value={f.dir} onChange={e=>set("dir",e.target.value)} style={{padding:"9px 11px",fontSize:14}}><option>Call</option><option>Put</option></select>
        </div>
        {inp("Stock now","spot","334.93")}
        {inp("Strike","strike","345")}
        {inp("Premium","prem","1.20")}
        {inp("Avg daily range","atr","6.20")}
        {inp("DTE","dte","4")}
        {inp("Risk budget $","budget","300")}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"2px 0 10px"}}>
        <button className="btn" onClick={autofill} disabled={busy||!String(f.sym||"").trim()} style={{padding:"7px 12px",fontSize:12.5}}>{busy?<span className="spin"/>:"⚡ Auto-fill price & range"}</button>
        <span className="mono" style={{fontSize:12,color:note?"var(--brass)":"var(--faint)"}}>{note||"Type a ticker — stock price & daily range fill in automatically. Strike, premium & DTE are the contract you choose."}</span>
      </div>
      {!ready && <div style={{fontSize:13,color:"var(--faint)",padding:"2px 0 10px"}}>Now add strike, premium and DTE to run the math.</div>}

      {ready && <>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:12.5,color:"var(--dim)",marginBottom:14,fontFamily:"'JetBrains Mono',monospace"}}>
          <span>Breakeven <b style={{color:"var(--bone)"}}>${be.toFixed(2)}</b></span>
          <span>{otm>0?"OTM by ":"ITM by "}<b style={{color:otm>0?"var(--brass)":"var(--bull)"}}>${Math.abs(otm).toFixed(2)}</b></span>
          {contracts>0 && <span><b style={{color:"var(--bone)"}}>{contracts} contracts</b> = <b style={{color:"var(--bone)"}}>{fmtMoney(cost)}</b> at risk</span>}
        </div>

        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5,minWidth:520}}>
            <thead><tr style={{textAlign:"left",color:"var(--faint)",fontSize:11.5,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"'JetBrains Mono',monospace"}}>
              {["Return","Stock must reach","Move needed","% move","Avg days of range","Reality","Position worth"].map((c,i)=>
                <th key={i} style={{padding:"8px 10px 8px 0",borderBottom:"1px solid var(--line)",fontWeight:500}}>{c}</th>)}
            </tr></thead>
            <tbody>{rows.map(r=>(
              <tr key={r.m} style={{borderBottom:"1px solid var(--line)"}}>
                <td className="mono" style={{padding:"11px 10px 11px 0",fontWeight:700,color:r.m===10?"var(--brass)":"var(--bone)"}}>+{r.m*100-100}%</td>
                <td className="mono" style={{padding:"11px 10px 11px 0",color:"var(--bone)"}}>${r.p.toFixed(2)}</td>
                <td className="mono" style={{padding:"11px 10px 11px 0",color:"var(--dim)"}}>${r.mv.toFixed(2)}</td>
                <td className="mono" style={{padding:"11px 10px 11px 0",color:"var(--dim)"}}>{r.pc.toFixed(1)}%</td>
                <td className="mono" style={{padding:"11px 10px 11px 0",color:"var(--dim)"}}>{isFinite(r.d)?r.d.toFixed(1)+"×":"—"}</td>
                <td style={{padding:"11px 10px 11px 0",color:r.vt,fontWeight:600}}>{r.vl}</td>
                <td className="mono" style={{padding:"11px 10px 11px 0",color:contracts?"var(--bull)":"var(--faint)"}}>{contracts?fmtMoney(cost*r.m):"—"}</td>
              </tr>))}
            </tbody>
          </table>
        </div>

        <div style={{marginTop:14,padding:13,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10,fontSize:13,color:"var(--comp)",lineHeight:1.65}}>
          <b style={{color:"var(--brass)"}}>How to read it: </b>
          “Avg days of range” is the honest filter — how many normal days of movement the stock needs, in one direction, before your contract expires. Under 1.5× with a catalyst is a real setup. Over 3× and you're buying a lottery ticket no matter how good the chart looks.
          {num(f.dte)>0 && isFinite(rows[2].d) && <span> You've got <b className="mono" style={{color:"var(--bone)"}}>{f.dte} days</b> to cover <b className="mono" style={{color:"var(--bone)"}}>{rows[2].d.toFixed(1)}×</b> the daily range for the 10-bagger.</span>}
          <br/><b style={{color:"var(--brass)"}}>Before expiry it's easier: </b>
          these lines assume expiration-day intrinsic value. With time left, remaining extrinsic gets you there sooner — which is exactly why you take it off <i>into</i> the move, not on expiration day.
        </div>
      </>}
    </div>
  );
}

/* ---------- the scanner ---------- */
/* Self-drawn candlestick chart with the setup levels drawn ON the candles.
   Bars come from /api/ohlc (server-side Yahoo fetch, no CORS). */
function ChartDraw({sym,interval,levels,height=440}){
  const wrapRef=useRef(null);
  const [w,setW]=useState(720);
  const [bars,setBars]=useState(null);
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const el=wrapRef.current; if(!el) return;
    const measure=()=>setW(Math.max(280,el.clientWidth||720));
    measure();
    let ro; if(typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(measure); ro.observe(el); }
    window.addEventListener("resize",measure);
    return ()=>{ window.removeEventListener("resize",measure); if(ro) ro.disconnect(); };
  },[]);

  useEffect(()=>{
    let dead=false;
    const rangeFor={"15m":"5d","60m":"1mo","1d":"6mo"};
    const iv=interval||"1d";
    setLoading(true); setErr(""); setBars(null);
    fetch(`/api/ohlc?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(iv)}&range=${rangeFor[iv]||"6mo"}`)
      .then(r=>r.json().then(j=>({ok:r.ok,j})).catch(()=>({ok:false,j:null})))
      .then(({ok,j})=>{ if(dead) return;
        if(!ok||!j||!Array.isArray(j.bars)||!j.bars.length) setErr((j&&j.error)||("No chart data for "+sym+"."));
        else setBars(j.bars.slice(-150));
      })
      .catch(()=>{ if(!dead) setErr("Couldn't load chart data."); })
      .finally(()=>{ if(!dead) setLoading(false); });
    return ()=>{ dead=true; };
  },[sym,interval]);

  const H=height, padL=6, padR=60, padT=10, padB=6;
  const plotW=Math.max(60,w-padL-padR), plotH=H-padT-padB;
  const box={height:H,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:20,color:"var(--faint)",fontSize:13};

  let inner;
  if(loading) inner=<div style={box}><span className="spin"/></div>;
  else if(err) inner=<div style={box}>{err}</div>;
  else if(bars&&bars.length){
    const lv=levels||{};
    const lvVals=[lv.trigger,lv.stop,lv.target,lv.level].map(Number).filter(v=>isFinite(v)&&v>0);
    let lo=Math.min(...bars.map(b=>b.l),...(lvVals.length?lvVals:[Infinity]));
    let hi=Math.max(...bars.map(b=>b.h),...(lvVals.length?lvVals:[-Infinity]));
    if(!isFinite(lo)||!isFinite(hi)||hi<=lo){ lo=Math.min(...bars.map(b=>b.l)); hi=Math.max(...bars.map(b=>b.h)); }
    const span=(hi-lo)||1; lo-=span*0.06; hi+=span*0.06;
    const y=p=>padT+(hi-p)/(hi-lo)*plotH;
    const n=bars.length, slot=plotW/n, bw=Math.max(1,Math.min(9,slot*0.62));
    const cur=bars[bars.length-1].c;
    const specs=[["Trigger",lv.trigger,"#e8ebef"],["Stop",lv.stop,"#dc2626"],["Target",lv.target,"#16a34a"],["Level",lv.level,"#f2be6e"]];
    inner=(
      <svg width={w} height={H} style={{display:"block"}}>
        {[0,0.25,0.5,0.75,1].map((f,i)=>{ const yy=padT+f*plotH; const p=hi-(hi-lo)*f; return (
          <g key={"g"+i}>
            <line x1={padL} y1={yy} x2={padL+plotW} y2={yy} stroke="#232a34" strokeWidth="1"/>
            <text x={padL+plotW+5} y={yy+3} fontSize="10" fill="#8892a0" fontFamily="monospace">{p.toFixed(2)}</text>
          </g>);})}
        {bars.map((b,i)=>{ const cx=padL+slot*i+slot/2; const up=b.c>=b.o; const col=up?"#16a34a":"#dc2626";
          const yO=y(b.o),yC=y(b.c); const top=Math.min(yO,yC); const hgt=Math.max(1,Math.abs(yO-yC));
          return (<g key={"c"+i}>
            <line x1={cx} y1={y(b.h)} x2={cx} y2={y(b.l)} stroke={col} strokeWidth="1"/>
            <rect x={cx-bw/2} y={top} width={bw} height={hgt} fill={col}/>
          </g>);})}
        <line x1={padL} y1={y(cur)} x2={padL+plotW} y2={y(cur)} stroke="#f2be6e" strokeWidth="1" strokeDasharray="1 3" opacity="0.6"/>
        {specs.map(([lbl,val,c],i)=>{ const v=Number(val); if(val==null||!isFinite(v)||v<lo||v>hi) return null; const yy=y(v);
          return (<g key={"L"+i}>
            <line x1={padL} y1={yy} x2={padL+plotW} y2={yy} stroke={c} strokeWidth="1.3" strokeDasharray="5 4"/>
            <rect x={padL+plotW-1} y={yy-8} width={60} height={13} fill={c} rx="2"/>
            <text x={padL+plotW+3} y={yy+2} fontSize="9.5" fill="#0b0e13" fontFamily="monospace" fontWeight="700">{lbl} {v.toFixed(2)}</text>
          </g>);})}
      </svg>
    );
  } else inner=<div style={box}>No data.</div>;

  return <div ref={wrapRef} style={{width:"100%"}}>{inner}</div>;
}

/* In-app chart: self-drawn candles with the setup levels on them, plus a TradingView deep-link. */
function ChartModal({row,onClose}){
  const r=row||{};
  const sym=String(r.s||r.sym||"").toUpperCase();
  const [iv,setIv]=useState("D");
  const [showPL,setShowPL]=useState(false);
  const hasContract=num(r.strike)>0&&num(r.prem)>0;
  const L=linksFor(sym,iv);
  const tvE=encodeURIComponent(L.tvSym||sym);
  const embed=`https://s.tradingview.com/widgetembed/?symbol=${tvE}&interval=${iv}&theme=dark&style=1&toolbarbg=131722&withdateranges=1&hideideas=1&locale=en&timezone=America%2FNew_York`;
  const up=r.dir==="up"||r.dir==="Long"||r.dir==="Call";
  const trig=(r.trig!=null&&r.trig!=="")?num(r.trig):null;
  const stop=(r.inval!=null&&r.inval!=="")?num(r.inval):null;
  const risk=(trig!=null&&stop!=null)?Math.abs(trig-stop):null;
  const target=(trig!=null&&risk)?(up?trig+risk*3:trig-risk*3):null;
  useEffect(()=>{ const h=e=>{ if(e.key==="Escape") onClose(); }; window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[onClose]);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:"3vh 2vw"}}>
      <div onClick={e=>e.stopPropagation()} className="card" style={{width:"96vw",maxWidth:1000,maxHeight:"94vh",display:"flex",flexDirection:"column",padding:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"12px 16px",borderBottom:"1px solid var(--line)"}}>
          <span className="disp" style={{fontSize:20,fontWeight:800}}>{sym||"—"}</span>
          {r.dir && <span className="tag" style={{color:up?"var(--bull)":"var(--bear)",borderColor:up?"var(--bull)":"var(--bear)"}}>{up?"▲ Calls":"▼ Puts"}</span>}
          <span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>{L.exchName}</span>
          <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
            {[["15","15m"],["60","1h"],["D","1D"]].map(([v,l])=>(
              <button key={v} className="btn" onClick={()=>setIv(v)} style={{padding:"5px 10px",fontSize:12,borderColor:iv===v?"var(--brass)":"var(--line2)",color:iv===v?"var(--brass)":"var(--dim)"}}>{l}</button>))}
            {hasContract && <button className="btn" onClick={()=>setShowPL(v=>!v)} style={{padding:"5px 10px",fontSize:12,borderColor:showPL?"var(--brass)":"var(--line2)",color:showPL?"var(--brass)":"var(--dim)"}}>📉 P/L</button>}
          </div>
          <button className="btn" onClick={onClose} style={{padding:"5px 11px",fontSize:14}} aria-label="Close">✕</button>
        </div>
        {(trig!=null||stop!=null||target!=null||r.strike) && (
          <div style={{display:"flex",gap:16,flexWrap:"wrap",padding:"10px 16px",borderBottom:"1px solid var(--line)",fontFamily:"'JetBrains Mono',monospace",fontSize:12.5}}>
            {trig!=null && <span style={{color:"var(--faint)"}}>Trigger <b style={{color:"var(--bone)"}}>${trig.toFixed(2)}</b></span>}
            {stop!=null && <span style={{color:"var(--faint)"}}>Stop <b style={{color:"var(--bear)"}}>${stop.toFixed(2)}</b></span>}
            {target!=null && <span style={{color:"var(--faint)"}}>Target 1:3 <b style={{color:"var(--bull)"}}>${target.toFixed(2)}</b></span>}
            {r.strike && <span style={{color:"var(--faint)"}}>Contract <b style={{color:"var(--brass)"}}>${num(r.strike)} {up?"call":"put"}{r.dte?" · "+num(r.dte)+" DTE":""}</b></span>}
          </div>
        )}
        <div style={{flex:1,minHeight:340,background:"#0b0e13",overflow:"auto"}}>
          <ChartDraw sym={sym} interval={iv} levels={{trigger:trig,stop,target}}/>
          {showPL && hasContract && <div style={{padding:"12px 14px",borderTop:"1px solid var(--line)"}}>
            <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:7}}>P/L of buying the ${num(r.strike)} {up?"call":"put"}{r.dte?` · ${num(r.dte)}d`:""} @ ~${num(r.prem).toFixed(2)}</div>
            <MiniPayoff spot={num(r.px)||trig||num(r.strike)} dir={r.dir} strike={num(r.strike)} prem={num(r.prem)} dte={num(r.dte)||14} ivPct={num(r.ivr)?Math.max(12,Math.min(90,num(r.ivr))):null}/>
          </div>}
        </div>
        <div className="mono" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",fontSize:10.5,color:"var(--faint)",padding:"8px 16px",borderTop:"1px solid var(--line)",lineHeight:1.5}}>
          <span>Candles: Yahoo Finance · trigger / stop / target drawn are the app's read. Not financial advice.</span>
          <a href={L.tv} target="_blank" rel="noopener noreferrer" style={{marginLeft:"auto",color:"var(--brass)",textDecoration:"none",whiteSpace:"nowrap"}}>Open full chart on TradingView ↗</a>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ask the coach: reusable chat you can drop under any tab ----------
   Feed it a `context` string describing what's on screen (the scan results, the
   journal stats) and it answers with the same mentor brain + the trader's own
   knowledge base as the rest of the app. Each question is one paid AI call, so
   it stays manual — no auto-firing. */
function AskCoach({ title="Ask the coach", intro, context="", placeholder="Ask the coach…", suggestions=[] }){
  const [msgs,setMsgs]=useState([]);
  const [inp,setInp]=useState("");
  const [busy,setBusy]=useState(false);
  async function ask(q){
    const text=String(q!=null?q:inp).trim(); if(!text||busy) return;
    const hist=[...msgs,{role:"user",content:text}];
    setMsgs(hist); setInp(""); setBusy(true);
    try{
      const sys=await withKB(MENTOR_SYS+`\n\nThe trader is on a scan screen and is asking you, their coach, a question.${context?("\n\nCONTEXT — what's on their screen right now:\n"+context):""}\n\nAnswer using that context and their rules/knowledge base. Be blunt, probability-first and educational — never a guaranteed call, always tell them to confirm live prices themselves. You may search for current market info if it helps. Today is ${todayISO()}. Keep it tight (≤ 170 words).`);
      const res=await callClaude({ maxTokens:750, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:hist.map(m=>({role:m.role,content:m.content})) });
      setMsgs([...hist,{role:"assistant",content:getText(res)||"(no response)"}]);
    }catch(e){ setMsgs([...hist,{role:"assistant",content:"("+aiErr(e,"Reply")+")"}]); }
    setBusy(false);
  }
  const fld={fontFamily:"inherit",background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--bone)",borderRadius:8,padding:"9px 11px",fontSize:14,outline:"none"};
  return (
    <div className="card" style={{padding:18,marginTop:16,borderColor:"var(--brass-dim)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <div className="eyebrow" style={{margin:0,color:"var(--brass)"}}>🧠 {title}</div>
        <Help text="Ask the mentor coach anything about what's on this screen — which setup is cleanest, why a ticker scored where it did, which scanner is making you money, what to do next. Uses your rules + knowledge base. Each question is one AI call."/>
      </div>
      <div style={{fontSize:13,color:"var(--dim)",lineHeight:1.55,marginBottom:12}}>{intro||"Ask about anything on this screen. Answers use your rules and knowledge base."}</div>
      {msgs.length>0 &&
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10,maxHeight:340,overflowY:"auto"}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"88%",padding:"9px 12px",borderRadius:11,fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap",
              background:m.role==="user"?"var(--brass-dim)":"var(--bg)",color:m.role==="user"?"#241A0A":"var(--bone)",border:m.role==="user"?"none":"1px solid var(--line)"}}>{m.content}</div>
          ))}
          {busy && <div style={{alignSelf:"flex-start",padding:"9px 12px"}}><span className="spin"/></div>}
        </div>}
      {suggestions.length>0 && msgs.length===0 &&
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>
          {suggestions.map((s,i)=>(
            <button key={i} className="btn" onClick={()=>ask(s)} disabled={busy} style={{padding:"6px 11px",fontSize:12.5,borderColor:"var(--line2)",color:"var(--dim)"}}>{s}</button>
          ))}
        </div>}
      <div style={{display:"flex",gap:8}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")ask();}} placeholder={placeholder} style={{...fld,flex:1}}/>
        <button className="btn-primary btn" onClick={()=>ask()} disabled={busy||!inp.trim()}>Send</button>
      </div>
    </div>
  );
}

/* ---------- Scan journal: auto-logs every scan, matches the trades you took, scores each scanner ---------- */
async function logScan(source, syms, top, batchId){
  try{
    const log = await sGet("scan:log") || [];
    const arr = Array.isArray(log) ? log : [];
    // If this save carries a batchId, drop any existing entry for the same batch
    // so an explicit "Save to Scans" re-write is idempotent (no duplicate rows).
    const base = batchId!=null ? arr.filter(e=>e && e.batchId!==batchId) : arr;
    const entry = { id: Date.now()+"-"+Math.random().toString(36).slice(2,6), batchId: batchId!=null?batchId:null, ts: Date.now(), date: todayISO(),
      source, syms:(syms||[]).map(s=>String(s||"").toUpperCase()).filter(Boolean).slice(0,40), top:(top||[]).slice(0,40) };
    await sSet("scan:log", [entry, ...base].slice(0,400));
  }catch(e){}
}
function srcTone(s){ return s==="Runner"?"var(--brass)":s==="Bias scan"?"var(--focus)":(s==="Goal plays"||s==="Account plays")?"var(--bull)":"var(--comp)"; }
function daysApart(a,b){ return Math.round((new Date(b)-new Date(a))/864e5); }
function ScanJournal({trades}){
  const [log,setLog]=useState(null);
  const [openId,setOpenId]=useState(null);
  const [srcFilter,setSrcFilter]=useState("all");
  useEffect(()=>{ (async()=>{ const l=await sGet("scan:log"); setLog(Array.isArray(l)?l:[]); })(); },[]);
  const tradesFor=(scan)=>(trades||[]).filter(t=>{
    const tk=(t.ticker||"").toUpperCase(); if(!tk) return false;
    if(!(scan.syms||[]).map(s=>String(s).toUpperCase()).includes(tk)) return false;
    const gap=daysApart(scan.date,t.date); return gap>=0 && gap<=3;
  });
  const sources=useMemo(()=>[...new Set((log||[]).map(s=>s.source))],[log]);
  const shown=(log||[]).filter(s=>srcFilter==="all"||s.source===srcFilter);
  const stats=useMemo(()=>{
    if(!log) return null;
    const bySrc={}; let scansWithTrade=0; const seen=new Set();
    for(const s of log){
      const b=bySrc[s.source]||(bySrc[s.source]={scans:0,taken:0,wins:0,losses:0,pnl:0});
      b.scans++;
      const tl=tradesFor(s); if(tl.length) scansWithTrade++;
      for(const t of tl){ const key=s.source+"|"+t.id; if(seen.has(key)) continue; seen.add(key);
        const p=computePnl(t); if(p==null) continue; b.taken++; b.pnl+=p; if(p>0)b.wins++; else if(p<0)b.losses++; }
    }
    const totals=Object.values(bySrc).reduce((a,b)=>({scans:a.scans+b.scans,taken:a.taken+b.taken,wins:a.wins+b.wins,losses:a.losses+b.losses,pnl:a.pnl+b.pnl}),{scans:0,taken:0,wins:0,losses:0,pnl:0});
    return {bySrc,totals,scansWithTrade};
  },[log,trades]);
  const rate=(w,l)=> (w+l>0)?Math.round(w/(w+l)*100):null;
  async function clearLog(){ if(!confirm("Clear the whole scan log? Your trades stay untouched.")) return; await sSet("scan:log",[]); setLog([]); }
  if(!log) return <div className="card" style={{padding:20,color:"var(--faint)",fontSize:14}}>Loading scan history…</div>;
  return (
    <div>
      <div className="card" style={{padding:20,marginBottom:16}}>
        <div className="eyebrow" style={{marginBottom:5}}>Scan journal</div>
        <div className="disp" style={{fontSize:25,fontWeight:800,marginBottom:8}}>Which scanner actually pays</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.65}}>Every scan you run — Runner, goal &amp; account plays, watchlist bias — is filed here automatically. When you log a trade in a ticker a scan surfaced (within 3 sessions), it's matched back, so you learn which tool produces your winners.</div>
      </div>

      {stats && stats.totals.scans>0 && (<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:14}}>
          {[["Scans run",stats.totals.scans,"var(--bone)"],
            ["Turned into trades",stats.totals.taken,"var(--brass)"],
            ["Win rate", rate(stats.totals.wins,stats.totals.losses)!=null?rate(stats.totals.wins,stats.totals.losses)+"%":"—", rate(stats.totals.wins,stats.totals.losses)>=50?"var(--bull)":"var(--bear)"],
            ["Net P&L", fmtMoney(stats.totals.pnl), stats.totals.pnl>=0?"var(--bull)":"var(--bear)"]
          ].map(([l,v,tone],i)=>(
            <div key={i} className="card" style={{padding:13}}>
              <div className="eyebrow" style={{fontSize:10,marginBottom:4}}>{l}</div>
              <div className="mono" style={{fontSize:22,fontWeight:800,color:tone,lineHeight:1.1}}>{v}</div>
            </div>))}
        </div>
        <div className="card" style={{padding:16,marginBottom:16}}>
          <div className="eyebrow" style={{marginBottom:11}}>By scanner</div>
          {Object.entries(stats.bySrc).sort((a,b)=>b[1].scans-a[1].scans).map(([src,b])=>{ const r=rate(b.wins,b.losses); return (
            <div key={src} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--line)",flexWrap:"wrap"}}>
              <div style={{flex:"1 1 110px",fontSize:13.5,fontWeight:700,color:srcTone(src)}}>{src}</div>
              <div className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>{b.scans} scans</div>
              <div className="mono" style={{fontSize:12.5,color:"var(--dim)"}}>{b.taken} taken</div>
              <div className="mono" style={{fontSize:13.5,fontWeight:700,color:r==null?"var(--faint)":r>=50?"var(--bull)":"var(--bear)"}}>{r==null?"—":r+"%"}</div>
              <div className="mono" style={{fontSize:13.5,fontWeight:700,minWidth:64,textAlign:"right",color:b.pnl>=0?"var(--bull)":"var(--bear)"}}>{b.taken?fmtMoney(b.pnl):"—"}</div>
            </div>);})}
        </div>
      </>)}

      {log.length>0 && <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
        <span className="eyebrow">Show</span>
        {["all",...sources].map(s=>(
          <button key={s} className="btn" onClick={()=>setSrcFilter(s)} style={{padding:"6px 12px",fontSize:12.5,borderColor:srcFilter===s?"var(--brass)":"var(--line2)",color:srcFilter===s?"var(--brass)":"var(--dim)"}}>{s==="all"?"All":s}</button>))}
        <button className="btn" onClick={clearLog} style={{marginLeft:"auto",padding:"6px 12px",fontSize:12.5,color:"var(--faint)"}}>Clear log</button>
      </div>}

      {log.length===0 && <div className="card" style={{padding:20,fontSize:14,color:"var(--dim)"}}>No scans logged yet. Run a scan on the <b style={{color:"var(--bone)"}}>Runner</b>, <b style={{color:"var(--bone)"}}>Watchlist</b>, or <b style={{color:"var(--bone)"}}>Today</b> tab and it shows up here automatically.</div>}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {shown.map(s=>{ const tl=tradesFor(s); const open=openId===s.id; const pnl=tl.reduce((a,t)=>{const p=computePnl(t);return a+(p||0);},0); return (
          <div key={s.id} className="card" style={{padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",cursor:"pointer"}} onClick={()=>setOpenId(open?null:s.id)}>
              <span className="tag" style={{color:srcTone(s.source),borderColor:srcTone(s.source)}}>{s.source}</span>
              <span className="mono" style={{fontSize:13,color:"var(--dim)"}}>{new Date(s.ts).toLocaleString()}</span>
              <span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>{s.syms.length} ticker{s.syms.length===1?"":"s"}</span>
              <span style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
                {tl.length>0
                  ? <span className="mono" style={{fontSize:13,fontWeight:700,color:pnl>=0?"var(--bull)":"var(--bear)"}}>{tl.length} trade{tl.length===1?"":"s"} · {fmtMoney(pnl)}</span>
                  : <span className="mono" style={{fontSize:12.5,color:"var(--faint)"}}>no trade yet</span>}
                <span style={{color:"var(--faint)"}}>{open?"▲":"▼"}</span>
              </span>
            </div>
            {open && <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--line)"}}>
              <div style={{marginBottom:tl.length?12:0}}>
                {/* Carry the FULL scan read through for every ticker — score, direction, price, why,
                    trigger, wrong-past, range, IV, chain, catalyst — falling back to a chip when a
                    scanner only stored a short note. */}
                {(() => {
                  const list=(s.syms&&s.syms.length)
                    ? s.syms.map(sym=>{ const hit=(s.top||[]).find(x=>String(x.s).toUpperCase()===String(sym).toUpperCase()); return hit?{...hit,s:sym}:{s:sym}; })
                    : (s.top||[]);
                  const rich=list.some(it=> it.score!=null || it.trig!=null || it.why);
                  if(!rich) return (
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {list.map((it,i)=>(<span key={i} className="mono" style={{fontSize:12.5,background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:8,padding:"5px 10px"}}><b style={{color:"var(--bone)"}}>{it.s}</b>{it.note?<span style={{color:"var(--faint)"}}> · {it.note}</span>:null}</span>))}
                    </div>);
                  return (
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:10}}>
                      {list.map((it,i)=>{ const up=!(it.dir==="down"||it.dir==="Put"||it.dir==="puts"); return (
                        <div key={i} style={{padding:"10px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <b className="disp" style={{fontSize:15,color:"var(--bone)"}}>{it.s}</b>
                            {it.dir && <span className="tag" style={{color:up?"var(--bull)":"var(--bear)",borderColor:up?"var(--bull)":"var(--bear)"}}>{up?"▲ calls":"▼ puts"}</span>}
                            {it.px!=null && <span className="mono" style={{fontSize:12.5,color:"var(--dim)"}}>${num(it.px).toFixed(2)}</span>}
                            {it.score!=null && <span className="mono" style={{marginLeft:"auto",fontSize:17,fontWeight:800,color:scoreTone(it.score)}}>{it.score}</span>}
                          </div>
                          {it.why && <div style={{fontSize:12.5,color:"var(--comp)",lineHeight:1.5,marginTop:6}}>{it.why}</div>}
                          <div style={{display:"flex",gap:11,flexWrap:"wrap",marginTop:7,fontSize:11.5,fontFamily:"'JetBrains Mono',monospace"}}>
                            {it.trig!=null && <span style={{color:"var(--faint)"}}>Trig <b style={{color:"var(--bone)"}}>${num(it.trig).toFixed(2)}</b></span>}
                            {it.inval!=null && <span style={{color:"var(--faint)"}}>Wrong <b style={{color:"var(--bear)"}}>${num(it.inval).toFixed(2)}</b></span>}
                            {it.atr!=null && <span style={{color:"var(--faint)"}}>Range <b style={{color:"var(--bone)"}}>${num(it.atr).toFixed(2)}</b></span>}
                            {it.ivr!=null && <span style={{color:"var(--faint)"}}>IV <b style={{color:num(it.ivr)>60?"var(--bear)":"var(--bull)"}}>{num(it.ivr)}</b></span>}
                            {it.liq && <span style={{color:"var(--faint)"}}>Chain <b style={{color:"var(--bone)"}}>{it.liq}</b></span>}
                            {it.ev && it.ev!=="none" && <span style={{color:"var(--faint)"}}>Cat <b style={{color:"var(--brass)"}}>{it.ev}</b></span>}
                            {it.score==null && it.note && <span style={{color:"var(--faint)"}}>{it.note}</span>}
                          </div>
                        </div>);})}
                    </div>);
                })()}
              </div>
              {tl.map(t=>{ const p=computePnl(t); return (
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px solid var(--line)"}}>
                  <span className="mono" style={{fontSize:13}}><b>{t.ticker}</b> <span style={{color:"var(--dim)"}}>{t.direction} · {t.setup} · {t.date}</span></span>
                  <span className="mono" style={{fontSize:13,fontWeight:700,color:(p||0)>=0?"var(--bull)":"var(--bear)"}}>{p!=null?fmtMoney(p):"open"}</span>
                </div>);})}
            </div>}
          </div>);})}
      </div>

      <AskCoach
        title="Ask the coach about your scans"
        intro="This tab knows which scanner surfaced your winners and which just burns clicks. Ask which one is actually paying, what's dragging your win rate, or which scan to trust tomorrow."
        context={(stats&&stats.totals.scans)
          ? `Scan-journal summary — ${stats.totals.scans} scans run, ${stats.totals.taken} turned into trades, overall win rate ${rate(stats.totals.wins,stats.totals.losses)!=null?rate(stats.totals.wins,stats.totals.losses)+"%":"n/a"}, net P&L ${fmtMoney(stats.totals.pnl)}.\nBy scanner: ${Object.entries(stats.bySrc).map(([src,b])=>`${src} — ${b.scans} scans, ${b.taken} taken, ${b.wins}W/${b.losses}L${b.taken?`, net ${fmtMoney(b.pnl)}`:""}`).join("; ")}.\nMost recent scans: ${(log||[]).slice(0,8).map(s=>`${s.source} ${new Date(s.ts).toLocaleDateString()} [${(s.syms||[]).slice(0,6).join(", ")}]`).join(" | ")}.`
          : "No scans have been logged yet."}
        placeholder="e.g. which scanner is actually making me money?"
        suggestions={(stats&&stats.totals.scans)?["Which scanner is actually making me money?","What's dragging my win rate down?","Which scan should I trust most tomorrow?"]:["How will this tab help me once I start scanning?"]}
      />
    </div>
  );
}

/* App-level runner-scan store. The scan runs here, OUTSIDE the tab component, so
   switching tabs never cancels it — you leave, come back, and it's either still
   running (with live progress) or the results are waiting. Any mounted RunnerScan
   subscribes to this and reflects it. */
const runnerStore = { state:{rows:null,loading:false,prog:"",err:"",when:null}, subs:new Set(), running:false, hydrated:false };
function rsSet(patch){ runnerStore.state={...runnerStore.state,...patch}; runnerStore.subs.forEach(f=>f()); }
function rsSubscribe(f){ runnerStore.subs.add(f); return ()=>{ runnerStore.subs.delete(f); }; }
function rsSnapshot(){ return runnerStore.state; }
async function hydrateRunner(){
  if(runnerStore.hydrated) return; runnerStore.hydrated=true;
  try{ const s=await sGet("runner_scan"); if(s&&Array.isArray(s.rows)) rsSet({rows:s.rows, when:s.when||null}); }catch(e){}
}
async function runRunnerScan(watch, extra){
  if(runnerStore.running) return;
  runnerStore.running=true;
  rsSet({loading:true, err:"", rows:null, prog:""});
  try{
    const typed=String(extra||"").split(/[,\s]+/).map(x=>x.trim().toUpperCase()).filter(Boolean);
    const syms=[...new Set([...typed,...(watch||[])])].slice(0,12);
    if(!syms.length){ rsSet({err:"Add tickers to your watchlist, or type some above.", loading:false}); runnerStore.running=false; return; }
    const chunks=[]; for(let i=0;i<syms.length;i+=6) chunks.push(syms.slice(i,i+6));
    let all=[];
    for(let ci=0;ci<chunks.length;ci++){
      rsSet({prog:`Grading ${ci*6+1}–${Math.min((ci+1)*6,syms.length)} of ${syms.length}…`});
      const sys=await withKB(RUNNER_SYS+`\n\nReturn ONLY a compact JSON array, no prose or fences:
[{"s":"GOOGL","dir":"up","px":356.15,"atr":6.2,"comp":21,"lvl":19,"cat":22,"fuel":14,"ivr":48,"liq":"thick","trig":359.68,"inval":344.8,"strike":365,"prem":1.35,"dte":5,"ev":"Q2 earnings Aug 5","why":"what's coiled, what level breaks it"}]
dir="up"|"down". px=last close. atr=avg DAILY range in $ (~14d). comp/lvl/cat/fuel=0-25 ints. ivr=IV rank 0-100. liq="thick"|"ok"|"thin". trig=exact trigger price. inval=price that proves it wrong. strike=the slightly-OTM strike you'd buy in the dir direction. prem=rough per-share premium at that dte. ev=catalyst in <=4 words or "none". why<=14 words. Keep every field TIGHT so the full JSON fits.`);
      const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys,
        messages:[{role:"user",content:`Runner scan for: ${chunks[ci].join(", ")}. Today is ${todayISO()}. Reply with ONLY the JSON array.`}] });
      let j=extractJson(getText(res)); if(!Array.isArray(j)||!j.length) j=extractObjs(getText(res));
      if(Array.isArray(j)) all=all.concat(j.filter(x=>x&&x.s));
    }
    rsSet({prog:""});
    if(all.length){ all.sort((a,b)=>runnerScore(b)-runnerScore(a)); const t=Date.now(); rsSet({rows:all, when:t}); sSet("runner_scan",{rows:all,when:t}); logScan("Runner", all.map(r=>r.s), all.map(r=>({s:r.s,dir:r.dir,px:num(r.px),score:runnerScore(r),why:r.why,trig:num(r.trig),inval:num(r.inval),atr:num(r.atr),ivr:r.ivr!=null?num(r.ivr):null,liq:r.liq,ev:r.ev})), t); }
    else rsSet({err:"Nothing came back — tap again to retry."});
  }catch(e){ rsSet({prog:"", err:aiErr(e,"Scan")}); }
  rsSet({loading:false});
  runnerStore.running=false;
}
function RunnerScan({watch}){
  const st = useSyncExternalStore(rsSubscribe, rsSnapshot, rsSnapshot);
  const { rows, loading, prog, err, when } = st;
  const [extra,setExtra]=useState("");
  const [open,setOpen]=useState(null);
  const [plOpen,setPlOpen]=useState(null);
  const [seed,setSeed]=useState(null);
  const [minScore,setMinScore]=useState(0);
  const [chart,setChart]=useState(null);
  const [ready,setReady]=useState(false);
  const [saved,setSaved]=useState("");

  useEffect(()=>{ (async()=>{ await hydrateRunner(); setReady(true); })(); },[]);
  useAutoScan(ready, when, loading, ()=>scan());

  // Explicit save: write EVERY ticker's full detail to the Scans journal. Uses the
  // scan's timestamp as a batch id so re-saving updates that entry instead of
  // duplicating it — a guaranteed, one-tap way to move the whole scan to Scans.
  async function saveToScans(){
    if(!rows || !rows.length){ setSaved("Run a scan first."); return; }
    const t = when || Date.now();
    await logScan("Runner", rows.map(r=>r.s),
      rows.map(r=>({s:r.s,dir:r.dir,px:num(r.px),score:runnerScore(r),why:r.why,trig:num(r.trig),inval:num(r.inval),atr:num(r.atr),ivr:r.ivr!=null?num(r.ivr):null,liq:r.liq,ev:r.ev})), t);
    setSaved(`Saved all ${rows.length} tickers — full detail is in the Scans tab.`);
  }

  function scan(){ setSaved(""); runRunnerScan(watch, extra); }

  const shown=(rows||[]).filter(r=>runnerScore(r)>=minScore);

  return (
    <div>
      {chart && <ChartModal row={chart} onClose={()=>setChart(null)}/>}
      <div className="card" style={{padding:20,marginBottom:16}}>
        <div className="eyebrow" style={{marginBottom:5}}>Runner scan</div>
        <div className="disp" style={{fontSize:25,fontWeight:800,marginBottom:8}}>Hunting the 1000% move</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.65,marginBottom:16}}>
          A 10-bagger contract isn't a lucky pick — it's a structure. The stock coils, sits under a magnet level, a catalyst forces it through, and the premium was still cheap when you bought. This grades your list on all four, then makes you check the math before you fall in love.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}>
          {[["Compression","Coiled, not extended. Tight ranges, inside days, a narrow base."],
            ["Level","Parked right under the magnet — PDH, PWH, 52-wk high, ORB line."],
            ["Catalyst","Something in the next few sessions that forces the break."],
            ["Fuel","Premium still cheap, chain liquid enough to sell at +1000%."]].map(([t,d],i)=>(
            <div key={i} style={{padding:12,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
              <div className="mono" style={{fontSize:12,fontWeight:700,color:"var(--brass)",marginBottom:5}}>{(i+1)+". "+t.toUpperCase()}</div>
              <div style={{fontSize:12.5,color:"var(--comp)",lineHeight:1.5}}>{d}</div>
            </div>))}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <input value={extra} onChange={e=>setExtra(e.target.value)} placeholder="Extra tickers (optional) — GOOGL, PLTR, SOFI" style={{flex:"1 1 220px",padding:"10px 12px",fontSize:14}}/>
          <button className="btn btn-primary" onClick={scan} disabled={loading} style={{opacity:loading?.6:1}}>
            {loading?<span><span className="spin"/>{"  Scanning…"}</span>:"⚡ Scan for runners"}
          </button>
          <span className="mono" style={{fontSize:11.5,color:"var(--faint)"}}>top 12 · 2 AI calls</span>
        </div>
        {prog && <div className="mono" style={{fontSize:12.5,color:"var(--brass)",marginTop:10}}>{prog}</div>}
        {err && <div style={{fontSize:13,color:"var(--bear)",marginTop:10}}>{err}</div>}
        {when && !loading && <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:10}}>Last scan {new Date(when).toLocaleString()}</div>}
      </div>

      {/* Key / legend — what every field on a runner card means. */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:11}}>
          <div className="eyebrow" style={{margin:0}}>Key — what each field means</div>
          <Help text="A plain-language legend for every number on a runner card. Everything here is a structural read, not a prediction — confirm live prices on your own screen."/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:"10px 20px"}}>
          {[["Runner score","0–100 blend of the four grades (Compression · Level · Catalyst · Fuel). Higher = more of a coiled-under-a-magnet setup."],
            ["▲ Calls / ▼ Puts","The direction the structure favors — calls for an upside break, puts for a downside break."],
            ["Trigger","The exact price that confirms the move. No trade until price actually breaks it."],
            ["Wrong past","The invalidation level. If price trades past this, the setup failed — get out."],
            ["Daily range","Average daily travel in dollars (ATR). Roughly how far it moves in a day."],
            ["IV rank","0–100, how pricey options are vs the last year. High (60+) = premium already rich, IV-crush risk."],
            ["Chain","Option liquidity — thick / ok / thin. Thin means hard to fill and scale out cleanly."],
            ["Catalyst","The event expected to force the break (earnings, NFP, Fed…), or 'none'."]
          ].map(([t,d],i)=>(
            <div key={i} style={{display:"flex",gap:9,alignItems:"flex-start"}}>
              <span className="mono" style={{fontSize:12,fontWeight:800,color:"var(--brass)",whiteSpace:"nowrap",flex:"0 0 104px"}}>{t}</span>
              <span style={{fontSize:12.5,color:"var(--comp)",lineHeight:1.5}}>{d}</span>
            </div>))}
        </div>
      </div>

      {rows && rows.length>0 && <div className="card" style={{padding:14,marginBottom:14,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",borderColor:"var(--brass-dim)"}}>
        <button className="btn btn-primary" onClick={saveToScans} style={{padding:"9px 16px",fontSize:14}}>💾 Save full scan to Scans</button>
        <span style={{fontSize:13,color:saved?"var(--bull)":"var(--dim)",lineHeight:1.5}}>{saved || `Moves all ${rows.length} tickers — every field — into your Scans journal.`}</span>
      </div>}

      {rows && <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
        <span className="eyebrow">Show</span>
        {[[0,"All"],[55,"55+"],[70,"70+ only"]].map(([v,l])=>(
          <button key={v} className="btn" onClick={()=>setMinScore(v)} style={{padding:"7px 13px",fontSize:13,borderColor:minScore===v?"var(--brass)":"var(--line2)",color:minScore===v?"var(--brass)":"var(--dim)"}}>{l}</button>))}
        <span className="mono" style={{fontSize:12,color:"var(--faint)",marginLeft:"auto"}}>{shown.length} of {rows.length}</span>
      </div>}

      {shown.map((r,i)=>{
        const sc=runnerScore(r), isOpen=open===r.s, up=r.dir==="up";
        return (
          <div key={r.s+i} className="card" style={{padding:16,marginBottom:10,borderColor:sc>=75?"var(--brass-dim)":"var(--line)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div className="disp" style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>{r.s}</div>
              <span className="tag" style={{color:up?"var(--bull)":"var(--bear)",borderColor:up?"var(--bull)":"var(--bear)"}}>{up?"▲ Calls":"▼ Puts"}</span>
              {r.px && <span className="mono" style={{fontSize:14,color:"var(--dim)"}}>${num(r.px).toFixed(2)}</span>}
              <div style={{marginLeft:"auto",textAlign:"right"}}>
                <div className="mono" style={{fontSize:26,fontWeight:800,lineHeight:1,color:scoreTone(sc)}}>{sc}</div>
                <div className="eyebrow" style={{fontSize:10}}>runner score</div>
              </div>
            </div>

            {r.why && <div style={{fontSize:13.5,color:"var(--comp)",lineHeight:1.6,marginTop:10}}>{r.why}</div>}

            <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:12,fontSize:12.5,fontFamily:"'JetBrains Mono',monospace"}}>
              {r.trig && <span style={{color:"var(--faint)"}}>Trigger <b style={{color:"var(--bone)"}}>${num(r.trig).toFixed(2)}</b></span>}
              {r.inval && <span style={{color:"var(--faint)"}}>Wrong past <b style={{color:"var(--bear)"}}>${num(r.inval).toFixed(2)}</b></span>}
              {r.atr && <span style={{color:"var(--faint)"}}>Daily range <b style={{color:"var(--bone)"}}>${num(r.atr).toFixed(2)}</b></span>}
              {r.ivr!=null && <span style={{color:"var(--faint)"}}>IV rank <b style={{color:num(r.ivr)>60?"var(--bear)":"var(--bull)"}}>{num(r.ivr)}</b></span>}
              {r.liq && <span style={{color:"var(--faint)"}}>Chain <b style={{color:r.liq==="thin"?"var(--bear)":"var(--bone)"}}>{r.liq}</b></span>}
              {r.ev && r.ev!=="none" && <span style={{color:"var(--faint)"}}>Catalyst <b style={{color:"var(--brass)"}}>{r.ev}</b></span>}
            </div>

            {num(r.ivr)>60 && <div style={{marginTop:10,fontSize:12.5,color:"var(--bear)",lineHeight:1.5}}>⚠ Premium is already rich here. If the catalyst is earnings, IV crush can eat the move even when you're right on direction.</div>}

            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:13}}>
              <button className="btn" onClick={()=>setOpen(isOpen?null:r.s)} style={{padding:"8px 13px",fontSize:13}}>{isOpen?"Hide the grade":"See the grade"}</button>
              <button className="btn btn-primary" style={{padding:"8px 13px",fontSize:13}}
                onClick={()=>{ setSeed({_t:Date.now(),sym:r.s,spot:String(num(r.px)||""),strike:String(num(r.strike)||""),prem:String(num(r.prem)||""),atr:String(num(r.atr)||""),dte:String(num(r.dte)||""),dir:r.dir==="down"?"Put":"Call"});
                  const el=document.getElementById("tenx"); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); }}>Run the 10x math →</button>
              <button className="btn" onClick={()=>setChart(r)} style={{padding:"8px 13px",fontSize:13}}>📈 Chart it for me</button>
              {r.strike>0 && r.prem>0 && <button className="btn" onClick={()=>setPlOpen(plOpen===r.s?null:r.s)} style={{padding:"8px 13px",fontSize:13,borderColor:plOpen===r.s?"var(--brass)":"var(--line2)",color:plOpen===r.s?"var(--brass)":"var(--dim)"}}>📉 P/L curve</button>}
              <LinkBar sym={r.s}/>
            </div>

            {plOpen===r.s && r.strike>0 && r.prem>0 && <div style={{marginTop:12}}>
              <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginBottom:6}}>Buying the ${num(r.strike)} {r.dir==="down"?"put":"call"}{r.dte?` · ${num(r.dte)}d`:""} @ ~${num(r.prem).toFixed(2)} on ${r.s} at ${num(r.px)?"$"+num(r.px).toFixed(2):"last"}</div>
              <MiniPayoff spot={num(r.px)||num(r.strike)} dir={r.dir} strike={num(r.strike)} prem={num(r.prem)} dte={num(r.dte)||14} ivPct={num(r.ivr)?Math.max(12,Math.min(90,num(r.ivr))):null}/>
            </div>}

            {isOpen && <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--line)"}}>
              <ScoreBar label="Compression" v={r.comp}/>
              <ScoreBar label="Level" v={r.lvl}/>
              <ScoreBar label="Catalyst" v={r.cat}/>
              <ScoreBar label="Fuel" v={r.fuel}/>
              {r.strike && <div className="mono" style={{fontSize:12.5,color:"var(--dim)",marginTop:10}}>
                Suggested runner: <b style={{color:"var(--brass)"}}>${num(r.strike)} {r.dir==="down"?"put":"call"}{r.dte?" · "+num(r.dte)+" DTE":""}{r.prem?" · ~$"+num(r.prem).toFixed(2):""}</b>
              </div>}
            </div>}
          </div>
        );
      })}

      {rows && !shown.length && <div className="card" style={{padding:20,fontSize:14,color:"var(--dim)"}}>
        Nothing cleared that score. That's information too — on a lot of days there is no runner, and the discipline is to sit out rather than force one.
      </div>}

      <div id="tenx" style={{marginTop:18}}><TenXMath seed={seed} watch={watch}/></div>

      <AskCoach
        title="Ask the coach about these runners"
        intro="Ran the scan and not sure what to do with it? Ask which candidate is cleanest, why the top pick scored highest, or which to leave alone. Grounded in your current results and your rules."
        context={(rows&&rows.length)
          ? "Runner scan results, best first (score is 0–100):\n"+rows.slice(0,10).map(r=>`${r.s} ${r.dir==="down"?"puts":"calls"} — score ${runnerScore(r)}${r.px?` @ $${num(r.px).toFixed(2)}`:""}${r.trig?`, trigger $${num(r.trig)}`:""}${r.inval?`, wrong past $${num(r.inval)}`:""}${r.ivr!=null?`, IV rank ${num(r.ivr)}`:""}${r.liq?`, chain ${r.liq}`:""}${r.ev&&r.ev!=="none"?`, catalyst ${r.ev}`:""}${r.why?` — ${r.why}`:""}`).join("\n")
          : "The trader has not run a runner scan yet — no results are on screen."}
        placeholder="e.g. which of these has the cleanest setup?"
        suggestions={(rows&&rows.length)?["Which one has the cleanest setup?","Why did the top pick score highest?","Which of these would you skip, and why?"]:["What makes a good runner candidate?","How should I size a lottery runner?"]}
      />

      <div className="card" style={{padding:18,marginTop:16,borderColor:"var(--brass-dim)"}}>
        <div className="eyebrow" style={{color:"var(--brass)",marginBottom:8}}>Before you hunt these</div>
        <div style={{fontSize:13.5,color:"var(--comp)",lineHeight:1.75}}>
          The chart that 10x'd is the one that got screenshotted. The nine that coiled the same way and went nowhere didn't. Everything on this page is a <b style={{color:"var(--bone)"}}>structural candidate</b>, not a prediction — and even an A+ structure loses most of the time, because you're buying short-dated OTM premium where theta works against you every single day.
          <br/><br/>
          Which is why this only works as a <b style={{color:"var(--brass)"}}>small, repeatable slice</b> of the account — money you've already written off before you click buy. A 10-bagger on a position that's 1% of your account is a great year. A 10-bagger you <i>needed</i> is how people get wiped out on the nine before it.
          <br/><br/>
          <b style={{color:"var(--bone)"}}>And scale out.</b> Almost nobody rides the full 1000% — they ride 300%, refuse to sell, and watch it round-trip to zero. Bank pieces at 3x and 5x and let a runner ride on house money. Log every one in the Journal, win or zero, so you find out your real hit rate instead of guessing at it.
        </div>
      </div>
    </div>
  );
}

function StratScanner({watch}){
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState(""); const [scanTime,setScanTime]=useState(null); const [filt,setFilt]=useState("all"); const [prog,setProg]=useState("");
  async function scan(){
    if(loading) return; setLoading(true); setErr(""); setData(null);
    try{
      const syms=(watch||[]).slice(0,30);
      if(!syms.length){ setErr("Add tickers to your watchlist first."); setLoading(false); return; }
      const chunks=[]; for(let i=0;i<syms.length;i+=10) chunks.push(syms.slice(i,i+10));
      let all=[];
      for(let ci=0;ci<chunks.length;ci++){
        setProg(`Scanning ${ci*10+1}–${Math.min((ci+1)*10,syms.length)} of ${syms.length}…`);
        const sys=await withKB(MENTOR_SYS+`\n\nTASK — Strat FTFC screener. For EACH ticker judge the current Strat candle state on Daily, Weekly, Monthly, Quarterly (u=up/green, d=down/red, n=neutral/inside) and flag the actionable Strat pattern — "Nirvana 1-3" (inside then outside bar), "Holy Grail 3-1" (outside then inside), "2-1-2", "3-1-2", "2-2 rev", else "-". The latest candle may be FORMING so patterns are PENDING estimates. Return ONLY a compact JSON array and NOTHING else — no prose, no fences: [{"s":"NVDA","d":"u","w":"u","m":"u","q":"u","p":"Nirvana 1-3"}]. One object per ticker, "p" ≤ 14 chars.`);
        const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], system:sys, messages:[{role:"user",content:`Strat FTFC scan for: ${chunks[ci].join(", ")}. Today is ${todayISO()}. Reply with ONLY the JSON array.`}] });
        const j=extractJson(getText(res));
        if(Array.isArray(j)) all=all.concat(j.filter(x=>x&&x.s));
      }
      setProg("");
      if(all.length){ setData(all); setScanTime(Date.now()); } else setErr("Couldn't scan — try again.");
    }catch(e){ setProg(""); setErr(aiErr(e,"Scan")); }
    setLoading(false);
  }
  const col=(s)=> s==="u"?"var(--bull)": s==="d"?"var(--bear)":"var(--dim)";
  const badge=(letter,s)=><span style={{display:"inline-flex",width:26,height:26,alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:"#0E1116",borderRadius:5,background:col(s)}}>{letter}</span>;
  const ftfc=(r)=> (r.d===r.w&&r.w===r.m&&r.m===r.q)?(r.d==="u"?"up":r.d==="d"?"down":null):null;
  const filtered=(data||[]).filter(r=>{
    if(filt==="all")return true;
    if(filt==="nirvana")return /nirvana|1-3/i.test(r.p||"");
    if(filt==="holy")return /holy|3-1/i.test(r.p||"");
    if(filt==="ftfcU")return ftfc(r)==="up";
    if(filt==="ftfcD")return ftfc(r)==="down";
    return true;
  });
  const sorted=[...filtered].sort((a,b)=>{ const pa=(a.p&&a.p!=="-")?0:1; const pb=(b.p&&b.p!=="-")?0:1; return pa-pb; });
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
        <h2 className="disp" style={{margin:0,fontSize:22,fontWeight:800}}>Strat scanner</h2>
        <Help text="Scans your watchlist for Strat continuity and setups. Each row shows the candle state on Daily / Weekly / Monthly / Quarterly — green = up, red = down, grey = inside/neutral. All four the same color = Full Time Frame Continuity (FTFC), the highest-odds directional environment. It flags Nirvana (1-3: inside→outside, coiled then explosive) and Holy Grail (3-1: outside→inside, a clean tight coil). Estimated from delayed web data — the current candle may still be FORMING, so patterns are pending. Always confirm on your chart before trading."/>
      </div>
      <p style={{margin:"0 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>D/W/M/Q continuity + Strat setups across your watchlist. Tap a ticker's chart in Watchlist to confirm.</p>
      <button className="btn-primary btn" style={{width:"100%"}} onClick={scan} disabled={loading}>{loading?<span className="spin"/>:"🎯 Scan the watchlist"}</button>
      {loading && prog && <div className="mono" style={{fontSize:12.5,color:"var(--dim)",marginTop:8,textAlign:"center"}}>{prog}</div>}
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:8}}>{err}</div>}
      {data &&
        <div style={{marginTop:14}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {STRAT_FILTERS.map(([k,l])=>(
              <button key={k} onClick={()=>setFilt(k)} className="mono" style={{border:"1px solid "+(filt===k?"var(--brass-dim)":"var(--line2)"),background:filt===k?"var(--bg3)":"transparent",color:filt===k?"var(--brass)":"var(--dim)",borderRadius:7,padding:"5px 10px",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          <div style={{padding:"10px 13px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:10,marginBottom:12,fontSize:13,color:"var(--dim)",lineHeight:1.5}}>⚠ <b style={{color:"var(--brass)"}}>Forming-candle warning:</b> the current candle may still be in progress, so patterns are pending confirmation. Estimated from delayed data — confirm on your chart.</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
            <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>Key</span>
            <span style={{display:"inline-flex",gap:4,alignItems:"center"}}><span style={{width:13,height:13,borderRadius:3,background:"var(--bull)"}}/><span style={{fontSize:12,color:"var(--dim)"}}>up</span></span>
            <span style={{display:"inline-flex",gap:4,alignItems:"center"}}><span style={{width:13,height:13,borderRadius:3,background:"var(--bear)"}}/><span style={{fontSize:12,color:"var(--dim)"}}>down</span></span>
            <span style={{display:"inline-flex",gap:4,alignItems:"center"}}><span style={{width:13,height:13,borderRadius:3,background:"var(--dim)"}}/><span style={{fontSize:12,color:"var(--dim)"}}>inside</span></span>
            <span style={{fontSize:12,color:"var(--faint)"}}>· D/W/M/Q = Daily · Weekly · Monthly · Quarterly</span>
            <Help align="left" text="Each row is one ticker. The four squares are the Strat candle state on Daily, Weekly, Monthly and Quarterly: GREEN = that candle is up (bullish), RED = down (bearish), GREY = inside/neutral (coiling, no direction yet). When all four match colors, that's FTFC (Full Time Frame Continuity) — the highest-odds one-directional environment, and it gets an FTFC ▲/▼ flag. Mixed colors mean a broadening range: lower odds, trade the edges not continuation. The gold tag on the right is the actionable Strat pattern forming — tap it to see exactly what it means and how to trade it."/>
          </div>
          <div className="card" style={{padding:"6px 14px"}}>
            {sorted.length===0
              ? <div style={{padding:"20px",textAlign:"center",color:"var(--dim)",fontSize:14.5}}>Nothing matches that filter.</div>
              : sorted.map((r,i)=>{ const f=ftfc(r); return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<sorted.length-1?"1px solid var(--line)":"none",flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:3}}>{badge("D",r.d)}{badge("W",r.w)}{badge("M",r.m)}{badge("Q",r.q)}</div>
                  <span className="mono" style={{fontSize:15,fontWeight:700,color:"var(--focus)",minWidth:52}}>{r.s}</span>
                  <Help align="left" text={rowRead(r)}/>
                  {r.p&&r.p!=="-" && <PatternTag p={r.p}/>}
                  {f && <span className="mono" style={{fontSize:11.5,fontWeight:800,color:f==="up"?"var(--bull)":"var(--bear)"}}>FTFC {f==="up"?"▲":"▼"}</span>}
                </div>
              );})}
          </div>
          {scanTime && <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:8}}>Scanned {new Date(scanTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} · {sorted.length} shown</div>}
        </div>}
    </div>
  );
}

function Watchlist({watch,setWatch,quotes,setQuotes}){
  const [add,setAdd]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [sel,setSel]=useState(watch[0]||"IWM");
  const [bulk,setBulk]=useState(null); // {done,total,finished} while digging all
  const [bias,setBias]=useState({}); const [scanning,setScanning]=useState(false);
  const [scanData,setScanData]=useState(null);
  const [chartRow,setChartRow]=useState(null);
  const [biasWhen,setBiasWhen]=useState(null); const [biasReady,setBiasReady]=useState(false);
  useEffect(()=>{ setScanData(null); },[sel]);
  useEffect(()=>{(async()=>{ const b=await sGet("watch:bias"); if(b&&typeof b==="object") setBias(b); const t=await sGet("watch:bias:t"); if(t) setBiasWhen(t); setBiasReady(true); })();},[]);
  useAutoScan(biasReady, biasWhen, scanning, ()=>scanBias());
  async function scanBias(){
    if(scanning) return; setScanning(true); setErr("");
    try{
      const data=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}],
        system:"You are a market-structure scanner. For each ticker, judge its CURRENT trend bias from recent price action: higher-highs/higher-lows = bullish, lower-highs/lower-lows = bearish, choppy range = neutral. Return ONLY a JSON object mapping each SYMBOL to \"bullish\", \"bearish\", or \"neutral\" — e.g. {\"IWM\":\"bearish\",\"NVDA\":\"bullish\"}. No prose, no markdown fences.",
        messages:[{role:"user",content:`Current structural bias for each: ${watch.join(", ")}. Today is ${todayISO()}.`}]});
      const j=extractJson(getText(data));
      if(j&&typeof j==="object"){
        const clean={}; for(const k of Object.keys(j)){ const v=String(j[k]).toLowerCase(); clean[k.toUpperCase()]= v.includes("bull")?"bullish":v.includes("bear")?"bearish":"neutral"; }
        const merged={...bias,...clean}; setBias(merged); await sSet("watch:bias",merged); const t=Date.now(); setBiasWhen(t); await sSet("watch:bias:t",t); logScan("Bias scan", Object.keys(clean), Object.keys(clean).map(k=>({s:k,note:clean[k]})));
      } else setErr("Couldn't parse the scan — try again.");
    }catch(e){ setErr(aiErr(e,"Scan")); }
    setScanning(false);
  }
  useEffect(()=>{ if(watch.length && !watch.includes(sel)) setSel(watch[0]); },[watch]); // keep selection valid

  const addTicker=()=>{const s=add.toUpperCase().trim(); if(s&&!watch.includes(s)){setWatch([...watch,s]); setSel(s);} setAdd("");};
  const remove=s=>setWatch(watch.filter(x=>x!==s));

  async function digAll(){
    const targets=[...watch];
    setBulk({done:0,total:targets.length});
    for(let i=0;i<targets.length;i++){
      const s=targets[i];
      try{
        const existing=await sGet("intel:"+s);
        if(!existing||!existing.data){
          const res=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}],
            system:INTEL_SYS, messages:[{role:"user",content:`Ticker: ${s}. Largest holders/buyers, a short profile, and the latest news. Today is ${todayISO()}.`}]});
          const j=extractJson(getText(res));
          if(j) await sSet("intel:"+s,{data:j,ts:Date.now()});
        }
      }catch(e){ /* skip and continue */ }
      setBulk({done:i+1,total:targets.length});
    }
    setBulk(b=>b?{...b,finished:true}:null);
    setTimeout(()=>setBulk(null),5000);
  }

  useEffect(()=>{ if(watch&&watch.length) sync(); },[]); // free auto-load prices on open (no AI)
  async function sync(){
    setLoading(true); setErr("");
    try{
      const r=await fetch(`/api/quotes?symbols=${encodeURIComponent((watch||[]).join(","))}`);
      const j=await r.json().catch(()=>null);
      if(j&&j.quotes&&typeof j.quotes==="object") setQuotes(q=>({...q,...j.quotes}));
      else setErr((j&&j.error)||"Couldn't load quotes.");
    }catch(e){ setErr("Quote sync failed. Check connection and retry."); }
    setLoading(false);
  }

  const L=linksFor(sel);
  const sq=quotes[sel]; const spct=sq?.changePct;
  const scol=spct==null?"var(--dim)":spct>=0?"var(--bull)":"var(--bear)";
  const openA={fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:600,padding:"9px 14px",borderRadius:9,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,border:"1px solid var(--line2)"};

  return (
    <div>
      {chartRow && <ChartModal row={chartRow} onClose={()=>setChartRow(null)}/>}
      <RunnersToWatch onChart={setChartRow}/>
      {/* Chart & trade panel for selected symbol */}
      <div className="card" style={{padding:18,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0}}>Chart & trade both sides</div><Help text="The selected ticker's workspace: its chart, and one-tap links to trade it long OR short on your broker (calls/puts). Below is its Ticker Intel (holders + news). Tap any watchlist card to load it here."/></div>
            <div style={{display:"flex",alignItems:"baseline",gap:12}}>
              <span className="mono disp" style={{fontSize:28,fontWeight:800}}>{sel}</span>
              <span className="mono" style={{fontSize:20,fontWeight:600,color:scol}}>{sq?.price!=null?Number(sq.price).toFixed(2):"—"}</span>
              <span className="mono" style={{fontSize:14.5,color:scol}}>{spct==null?"":(spct>=0?"▲ +":"▼ ")+spct.toFixed(2)+"%"}</span>
            </div>
            <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:3}}>{L.exchName!=="—"?L.exchName+":"+sel:"exchange auto"} · pick any ticker →</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
            <span className="eyebrow" style={{fontSize:10,margin:0}}>Pick ticker</span>
            <select value={sel} onChange={e=>setSel(e.target.value)} title="Load any watchlist ticker here"
              style={{fontFamily:"'JetBrains Mono',monospace",background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--brass)",borderRadius:8,padding:"8px 12px",fontSize:15,fontWeight:700,appearance:"auto",cursor:"pointer",minWidth:110}}>
              {watch.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* launch links */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}>
          <button onClick={()=>setChartRow({s:sel})} style={{...openA,color:"#0E1116",background:"var(--brass)",borderColor:"var(--brass)",cursor:"pointer"}}>📈 Chart it for me</button>
          <a href={L.tv} target="_blank" rel="noopener" style={{...openA,color:"var(--focus)",borderColor:"var(--focus)"}}>📈 TradingView chart ↗</a>
          <a href={L.rh} target="_blank" rel="noopener" style={{...openA,color:"var(--bone)"}}>Robinhood ↗</a>
          <a href={L.wb} target="_blank" rel="noopener" style={{...openA,color:"var(--bone)"}}>Webull ↗</a>
        </div>

        {/* both sides */}
        <div className="eyebrow" style={{margin:"16px 0 8px"}}>Trade the setup — both sides</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <a href={L.rhOpt} target="_blank" rel="noopener" style={{...openA,color:"#0E1116",background:"var(--bull)",borderColor:"var(--bull)"}}>▲ Bullish · Calls ↗</a>
          <a href={L.rhOpt} target="_blank" rel="noopener" style={{...openA,color:"#0E1116",background:"var(--bear)",borderColor:"var(--bear)"}}>▼ Bearish · Puts ↗</a>
          <span className="mono" style={{fontSize:12,color:"var(--faint)",alignSelf:"center",maxWidth:220,lineHeight:1.4}}>Opens the {sel} options chain on Robinhood — pick your strike & expiry there.</span>
        </div>
        <BothSidesScanner sym={sel} onScan={setScanData}/>
        <div style={{marginTop:16}}>
          <div className="mono" style={{fontSize:12,color:"var(--faint)",marginBottom:8,lineHeight:1.5}}>↑ Scan fills the calculator below for both sides — toggle Long/Short to load each. Estimates; confirm premiums on your chain ↓</div>
          <ExamineNextTrade lockSym={sel} prefill={scanData} showScan={false}/>
        </div>

        {/* live chart */}
        <div style={{marginTop:16,borderTop:"1px solid var(--line)",paddingTop:16}}>
          <LiveChart sym={sel}/>
        </div>
        {/* intraday flow timing */}
        <div style={{marginTop:16,borderTop:"1px solid var(--line)",paddingTop:16}}>
          <FlowTiming sym={sel}/>
        </div>
        {/* ticker intel */}
        <div style={{marginTop:16,borderTop:"1px solid var(--line)",paddingTop:16}}>
          <TickerIntel sym={sel}/>
        </div>
      </div>

      {/* controls */}
      <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
        <input className="mono" style={{maxWidth:180}} placeholder="Add ticker" value={add}
          onChange={e=>setAdd(e.target.value.toUpperCase())}
          onKeyDown={e=>{if(e.key==="Enter")addTicker();}}/>
        <button className="btn" onClick={addTicker}>Add</button>
        <div style={{flex:1}}/>
        <button className="btn" onClick={scanBias} disabled={scanning} title="Scan the market and tag each ticker bullish/bearish/neutral">{scanning?<span className="spin"/>:"🧭 Scan bias"}</button>
        <button className="btn" onClick={digAll} disabled={!!bulk&&!bulk.finished}>{bulk&&!bulk.finished?<span className="spin"/>:"Dig into all"}</button>
        <button className="btn-primary btn" onClick={sync} disabled={loading}>{loading?<span className="spin"/>:"Sync quotes"}</button>
      </div>
      {bulk && <div className="mono" style={{fontSize:13,color:bulk.finished?"var(--bull)":"var(--brass)",marginBottom:10}}>{bulk.finished?`✓ Intel cached for all ${bulk.total} tickers`:`Digging intel… ${bulk.done}/${bulk.total} (runs in the background — keep using the app)`}</div>}
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginBottom:10}}>{err}</div>}
      <div style={{fontSize:13,color:"var(--faint)",marginBottom:14}} className="mono">Tap a card to load it above. Quotes are best-effort / delayed from web search, not a live feed.</div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(168px,1fr))",gap:12}}>
        {watch.map(s=>{
          const q=quotes[s]; const pct=q?.changePct;
          const col=pct==null?"var(--dim)":pct>=0?"var(--bull)":"var(--bear)";
          const active=s===sel;
          return (
            <div key={s} className="card" onClick={()=>setSel(s)}
              style={{padding:14,position:"relative",cursor:"pointer",borderColor:active?"var(--brass)":"var(--line)",boxShadow:active?"0 0 0 1px var(--brass)":"none"}}>
              <button onClick={e=>{e.stopPropagation();remove(s);}} style={{position:"absolute",top:8,right:9,background:"none",border:"none",color:"var(--faint)",fontSize:15,cursor:"pointer"}} title="Remove">×</button>
              <div style={{display:"flex",alignItems:"center",gap:7,paddingRight:16}}>
                <span className="mono" style={{fontSize:16,fontWeight:700}}>{s}</span>
                {bias[s] && <span className="mono" style={{fontSize:12,fontWeight:800,letterSpacing:"0.06em",padding:"2px 6px",borderRadius:4,
                  background: bias[s]==="bullish"?"rgba(63,183,130,0.15)":bias[s]==="bearish"?"rgba(231,106,91,0.15)":"var(--bg3)",
                  color: bias[s]==="bullish"?"var(--bull)":bias[s]==="bearish"?"var(--bear)":"var(--dim)"}}>{bias[s]==="bullish"?"▲ BULL":bias[s]==="bearish"?"▼ BEAR":"— NEUT"}</span>}
              </div>
              <div className="mono" style={{fontSize:22,fontWeight:600,color:col,marginTop:8,lineHeight:1}}>{q?.price!=null?Number(q.price).toFixed(2):"—"}</div>
              <div className="mono" style={{fontSize:13.5,color:col,marginTop:4,marginBottom:10}}>{pct==null?"no quote":(pct>=0?"▲ +":"▼ ")+pct.toFixed(2)+"%"}</div>
              <button className="btn" onClick={e=>{e.stopPropagation();setChartRow({s});}} style={{width:"100%",padding:"6px 0",fontSize:12,marginBottom:8}}>📈 Chart it for me</button>
              <LinkBar sym={s}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ NEWS ============================ */
/* ============================ TOOLS (pivots + ticker finder) ============================ */
/* Detect a liquidity sweep-and-reclaim on daily bars (free, no AI).
   Bullish: the latest bar wicks BELOW the recent swing low (grabs sellside stops)
   but CLOSES back above it — the hunt is done, reversal in play. Bearish is the
   mirror above the swing high. Returns the swept level, the reclaim close, and
   where the protective stop belongs (just past the wick), or null if no sweep. */
function detectSweep(bars){
  const b=(bars||[]).filter(x=>x&&isFinite(+x.h)&&isFinite(+x.l)&&isFinite(+x.c)).map(x=>({t:x.t,h:+x.h,l:+x.l,c:+x.c}));
  const n=b.length;
  if(n<15) return null;
  const k=2; // a swing pivot needs k bars on each side that don't exceed it
  // The swept level must be a real swing pivot price LEFT BEHIND — not just the
  // recent extreme, or a rising series would false-flag every new bar.
  function pivot(kind){
    for(let i=n-3;i>=k;i--){
      const v=kind==="high"?b[i].h:b[i].l; let ok=true;
      for(let j=i-k;j<=i+k;j++){ if(j===i) continue;
        if(kind==="high"){ if(b[j].h>v){ok=false;break;} } else { if(b[j].l<v){ok=false;break;} } }
      if(ok) return {idx:i,v};
    }
    return null;
  }
  const sh=pivot("high"), sl=pivot("low");
  const look=b.slice(Math.max(0,n-20));
  const range=Math.max(1e-6, Math.max(...look.map(x=>x.h))-Math.min(...look.map(x=>x.l)));
  // The sweep can be today's forming bar or yesterday's — check the last two.
  for(let idx=n-1; idx>=n-2; idx--){
    const sig=b[idx];
    if(sl && idx>sl.idx && sig.l<sl.v && sig.c>sl.v)
      return {dir:"up", level:sl.v, close:sig.c, stop:sig.l, depth:(sl.v-sig.l)/range, ago:n-1-idx};
    if(sh && idx>sh.idx && sig.h>sh.v && sig.c<sh.v)
      return {dir:"down", level:sh.v, close:sig.c, stop:sig.h, depth:(sig.h-sh.v)/range, ago:n-1-idx};
  }
  return null;
}
function LiquiditySweepScanner({watch}){
  const [hits,setHits]=useState(null);
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  const [done,setDone]=useState(0);
  const [total,setTotal]=useState(0);
  async function scan(){
    const syms=[...new Set((watch||[]).map(s=>String(s).toUpperCase()).filter(Boolean))].slice(0,24);
    if(!syms.length){ setNote("Add tickers to your watchlist first."); return; }
    setBusy(true); setNote(""); setHits(null); setDone(0); setTotal(syms.length);
    const out=[];
    for(let i=0;i<syms.length;i+=4){
      const batch=syms.slice(i,i+4);
      const res=await Promise.all(batch.map(async s=>{
        try{
          const r=await fetch(`/api/ohlc?symbol=${encodeURIComponent(s)}&interval=1d&range=3mo`);
          const j=await r.json().catch(()=>null);
          const bars=(j&&Array.isArray(j.bars))?j.bars:null;
          if(!bars) return null;
          const sw=detectSweep(bars);
          return sw?{s,...sw}:null;
        }catch(e){ return null; }
      }));
      res.forEach(x=>{ if(x) out.push(x); });
      setDone(Math.min(syms.length,i+batch.length));
    }
    out.sort((a,b)=>b.depth-a.depth);
    setHits(out); setBusy(false);
    setNote(out.length?`${out.length} sweep${out.length===1?"":"s"} across ${syms.length} tickers — deepest raids first.`
                      :`No fresh sweeps across ${syms.length} tickers — nobody's stops got raided.`);
  }
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        <div className="eyebrow" style={{margin:0}}>Liquidity sweep scanner</div>
        <Help text="Free, no AI. Scans your watchlist's daily bars for a stop hunt: price that wicked past a recent swing high/low to grab the obvious stops, then CLOSED back inside (a sweep-and-reclaim). That reclaim is the reversal — trade it instead of being the liquidity. See 'Don't be the liquidity' in the Playbook."/>
      </div>
      <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.6,margin:"8px 0 13px"}}>Finds tickers that just raided the obvious stops and reversed — a <b style={{color:"var(--bone)"}}>▲ reclaim</b> (swept the lows, closed back above → long bias) or <b style={{color:"var(--bone)"}}>▼ rejection</b> (swept the highs, closed back below → short bias). Put your stop past the wick, not on the level.</div>
      <button className="btn btn-primary" onClick={scan} disabled={busy} style={{opacity:busy?.6:1}}>
        {busy?<span><span className="spin"/>{`  Scanning ${done}/${total}…`}</span>:"🎯 Scan watchlist for sweeps"}
      </button>
      {note && <div className="mono" style={{fontSize:12.5,color:"var(--faint)",marginTop:11}}>{note}</div>}
      {hits && hits.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10,marginTop:14}}>
          {hits.map((h,i)=>{ const up=h.dir==="up"; return (
            <div key={i} style={{padding:"11px 13px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <b className="disp" style={{fontSize:15,color:"var(--bone)"}}>{h.s}</b>
                <span className="tag" style={{color:up?"var(--bull)":"var(--bear)",borderColor:up?"var(--bull)":"var(--bear)"}}>{up?"▲ reclaim · long":"▼ rejection · short"}</span>
                <span className="mono" style={{marginLeft:"auto",fontSize:11.5,color:"var(--faint)"}}>{h.ago===0?"today":h.ago+"d ago"}</span>
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8,fontSize:11.5,fontFamily:"'JetBrains Mono',monospace"}}>
                <span style={{color:"var(--faint)"}}>Swept <b style={{color:"var(--bone)"}}>${h.level.toFixed(2)}</b></span>
                <span style={{color:"var(--faint)"}}>Reclaim <b style={{color:up?"var(--bull)":"var(--bear)"}}>${h.close.toFixed(2)}</b></span>
                <span style={{color:"var(--faint)"}}>Stop <b style={{color:"var(--bear)"}}>${h.stop.toFixed(2)}</b></span>
              </div>
            </div>);})}
        </div>
      )}
    </div>
  );
}
function Tools({watch,setWatch}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <KeyLevels/>
      <LiquiditySweepScanner watch={watch}/>
      <PivotCalculator/>
      <StdDevCalculator/>
      <TickerFinder watch={watch} setWatch={setWatch}/>
    </div>
  );
}

const LEVEL_FIELDS=[["pwh","Previous week high","hi"],["pwl","Previous week low","lo"],["mh","Monday high","hi"],["ml","Monday low","lo"],["pdh","Previous day high","hi"],["pdl","Previous day low","lo"]];
const LEVEL_INDICATORS=[
  {t:"All-in-One: Weekly, Monday & Previous H/L", d:"Plots PWH/PWL, Monday high/low, current week + sessions — one toggle box", u:"https://www.tradingview.com/script/ySn3JPLj-All-In-One-Sessions-Weekly-Monday-Previous-Highs-Lows/"},
  {t:"Weekly Open + Monday High/Low", d:"Dedicated Monday range, plotted after Monday closes", u:"https://www.tradingview.com/script/hbadXipB-Weekly-Open-Monday-High-Low-After-Monday-Close/"},
  {t:"Previous Week & Day High/Low", d:"PWH/PWL + PDH/PDL with break & touch alerts", u:"https://www.tradingview.com/script/3skPivoz-Previous-Week-Day-High-Low/"},
];
function KeyLevels(){
  const [tk,setTk]=useState("IWM");
  const [vals,setVals]=useState({});
  const [saved,setSaved]=useState(null);
  const [status,setStatus]=useState("");
  const [filling,setFilling]=useState(false);
  useEffect(()=>{(async()=>{ const s=await sGet("levels:"+tk); setSaved(s||null); setVals((s&&s.vals)||{}); setStatus(""); })();},[tk]);
  const set=(k,v)=>setVals(o=>({...o,[k]:v}));
  const save=async()=>{ const clean={}; LEVEL_FIELDS.forEach(([k])=>{const n=num(vals[k]); if(n!=null)clean[k]=n;}); const rec={vals:clean,ts:Date.now()}; await sSet("levels:"+tk,rec); setSaved(rec); setStatus("Saved "+new Date().toLocaleTimeString()); };
  async function autofill(){
    const sym=(tk||"").toUpperCase(); if(!sym){ setStatus("Enter a ticker first."); return; }
    setFilling(true); setStatus("Fetching "+sym+" price…");
    try{
      const r=await fetch(`/api/ohlc?symbol=${encodeURIComponent(sym)}&interval=1d&range=3mo`);
      const j=await r.json().catch(()=>null);
      const bars=(j&&Array.isArray(j.bars))?j.bars:null;
      if(!r.ok||!bars||!bars.length){ setStatus((j&&j.error)||("No price data for "+sym)); setFilling(false); return; }
      const etDate=t=>{ try{ return new Date(new Date(t*1000).toLocaleString("en-US",{timeZone:"America/New_York"})); }catch(e){ return new Date(t*1000); } };
      const monKey=d=>{ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x.getTime(); };
      const bd=bars.map(b=>{ const d=etDate(b.t); return {h:Number(b.h),l:Number(b.l),d,dow:d.getDay(),key:monKey(d)}; });
      const today=etDate(Date.now()/1000), todayKey=monKey(today), todayStr=today.toDateString();
      let pi=bd.length-1; if(bd[pi]&&bd[pi].d.toDateString()===todayStr) pi--;
      const prevDay=bd[pi];
      const thisWk=bd.filter(b=>b.key===todayKey);
      const monBar=thisWk.find(b=>b.dow===1)||thisWk[0];
      const prevKeys=[...new Set(bd.map(b=>b.key))].filter(k=>k<todayKey).sort((a,b)=>a-b);
      const pwk=prevKeys[prevKeys.length-1];
      const pw=(pwk!=null)?bd.filter(b=>b.key===pwk):[];
      const next={};
      if(pw.length){ next.pwh=Math.max(...pw.map(b=>b.h)).toFixed(2); next.pwl=Math.min(...pw.map(b=>b.l)).toFixed(2); }
      if(monBar){ next.mh=monBar.h.toFixed(2); next.ml=monBar.l.toFixed(2); }
      if(prevDay){ next.pdh=prevDay.h.toFixed(2); next.pdl=prevDay.l.toFixed(2); }
      if(!Object.keys(next).length){ setStatus("Couldn't derive levels — try again."); setFilling(false); return; }
      setVals(v=>({...v,...next}));
      setStatus("Auto-filled from price — review, then Save levels.");
    }catch(e){ setStatus("Auto-fill failed — check connection."); }
    setFilling(false);
  }
  const rows = saved ? LEVEL_FIELDS.map(([k,l,side])=>({k,l,side,v:saved.vals[k]})).filter(r=>r.v!=null).sort((a,b)=>b.v-a.v) : [];
  const idxLink={display:"block",padding:"11px 13px",borderRadius:10,border:"1px solid var(--line2)",textDecoration:"none",background:"var(--bg)"};
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0}}>Key levels</div><Help text="Your pre-market lines: previous week high/low, Monday range, prior-day high/low. These are the pivots price reacts to — where your triggers, stops, and targets live. Mark them before the open so you're ready."/></div>
      <h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Previous-week & Monday levels</h3>
      <p style={{margin:"0 0 14px",fontSize:14.5,color:"var(--dim)"}}>Log the levels you trade off — previous week high/low, Monday's range, prior day. Tap <b style={{color:"var(--brass)"}}>⚡ Auto-fill from price</b> to pull them for this ticker, or type them in — then Save. Highs sit above in red (resistance), lows below in green (support).</p>

      <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap",marginBottom:12}}>
        <div style={{width:150}}><Field label="Ticker"><input className="mono" value={tk} onChange={e=>setTk(e.target.value.toUpperCase())}/></Field></div>
        <button className="btn" onClick={autofill} disabled={filling} style={{opacity:filling?0.6:1}}>{filling?<span className="spin"/>:"⚡ Auto-fill from price"}</button>
        <button className="btn-primary btn" onClick={save}>Save levels</button>
        {status && <span className="mono" style={{fontSize:12.5,color:"var(--brass-dim)"}}>{status}</span>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        {LEVEL_FIELDS.map(([k,l])=>(
          <Field key={k} label={l}><input className="mono" placeholder="0.00" value={vals[k]||""} onChange={e=>set(k,e.target.value)}/></Field>
        ))}
      </div>

      {rows.length>0 &&
        <div style={{marginTop:16,border:"1px solid var(--line)",borderRadius:11,overflow:"hidden"}}>
          <div className="mono" style={{padding:"8px 14px",background:"var(--bg2)",borderBottom:"1px solid var(--line)",fontSize:13}}>{tk} · saved levels (high → low)</div>
          {rows.map(r=>(
            <div key={r.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid var(--line)"}}>
              <span style={{fontSize:14,color:"var(--bone)"}}>{r.l}</span>
              <span className="mono" style={{fontSize:15.5,fontWeight:600,color:r.side==="hi"?"var(--bear)":"var(--bull)"}}>{r.v.toFixed(2)}</span>
            </div>
          ))}
        </div>}

      <div className="eyebrow" style={{margin:"18px 0 8px"}}>Auto-plot these on your chart — TradingView indicators</div>
      <p style={{margin:"0 0 10px",fontSize:13.5,color:"var(--dim)"}}>On TradingView, open <b style={{color:"var(--bone)"}}>Indicators</b>, search the name, and add it — the levels draw and update themselves so you don't redraw every Monday.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
        {LEVEL_INDICATORS.map(ind=>(
          <a key={ind.u} href={ind.u} target="_blank" rel="noopener" style={idxLink}>
            <div className="disp" style={{fontSize:15,fontWeight:700,color:"var(--focus)",lineHeight:1.3}}>{ind.t} ↗</div>
            <div style={{fontSize:13,color:"var(--dim)",marginTop:4,lineHeight:1.4}}>{ind.d}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

const PIV_METHODS=["Standard","Fibonacci","Camarilla"];
function PivotCalculator(){
  const [h,setH]=useState(""); const [l,setL]=useState(""); const [c,setC]=useState("");
  const [label,setLabel]=useState("IWM"); const [method,setMethod]=useState("Standard"); const [period,setPeriod]=useState("Prior day");
  const [busy,setBusy]=useState(false); const [note,setNote]=useState("");
  async function autofill(){
    const s=String(label||"").trim().toUpperCase(); if(!s||busy) return;
    setBusy(true); setNote("");
    try{
      const r=await fetch(`/api/ohlc?symbol=${encodeURIComponent(s)}&interval=1d&range=3mo`).then(x=>x.json()).catch(()=>null);
      const bars=(r&&Array.isArray(r.bars))?r.bars:[];
      if(!bars.length){ setNote("No data — enter the numbers manually."); setBusy(false); return; }
      const n = period==="Prior week"?5 : period==="Prior month"?21 : 1;
      const seg = bars.slice(-n);
      const hi=Math.max(...seg.map(b=>b.h)), lo=Math.min(...seg.map(b=>b.l)), cl=seg[seg.length-1].c;
      setH(hi.toFixed(2)); setL(lo.toFixed(2)); setC(cl.toFixed(2));
      setNote(`${s} · ${period.toLowerCase()} — H ${hi.toFixed(2)} / L ${lo.toFixed(2)} / C ${cl.toFixed(2)}`);
    }catch(e){ setNote("Couldn't fetch — enter manually."); }
    setBusy(false);
  }
  const H=num(h),L=num(l),C=num(c);
  const valid = H!=null && L!=null && C!=null && H>=L;
  let levels=[];
  if(valid){
    const range=H-L, pp=(H+L+C)/3;
    if(method==="Standard"){
      levels=[["R3",H+2*(pp-L)],["R2",pp+range],["R1",2*pp-L],["PP",pp],["S1",2*pp-H],["S2",pp-range],["S3",L-2*(H-pp)]];
    } else if(method==="Fibonacci"){
      levels=[["R3",pp+range],["R2",pp+0.618*range],["R1",pp+0.382*range],["PP",pp],["S1",pp-0.382*range],["S2",pp-0.618*range],["S3",pp-range]];
    } else {
      const r=range*1.1;
      levels=[["R4",C+r/2],["R3",C+r/4],["R2",C+r/6],["R1",C+r/12],["PP",pp],["S1",C-r/12],["S2",C-r/6],["S3",C-r/4],["S4",C-r/2]];
    }
  }
  const rowColor=k=> k==="PP"?"var(--brass)": k[0]==="R"?"var(--bear)":"var(--bull)";
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Indicator</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Pivot point calculator</h3><Help text="Enter a period's High, Low and Close and it plots the pivot (PP) with support (S1–S3) and resistance (R1–R3) levels. Price reacts at these — use them as intraday targets, stops, and bias (holding above PP = bullish lean). Standard, Fibonacci, or Camarilla."/></div>
      <p style={{margin:"0 0 14px",fontSize:14.5,color:"var(--dim)"}}>Enter the prior period's High, Low and Close to plot the pivot levels price reacts to. Above PP leans bullish, below leans bearish; R/S levels are your targets and stops.</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        <Field label="Ticker (label)"><input className="mono" value={label} onChange={e=>setLabel(e.target.value.toUpperCase())}/></Field>
        <Field label="Period"><select value={period} onChange={e=>setPeriod(e.target.value)}>{["Prior day","Prior week","Prior month"].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="High"><input className="mono" placeholder="0.00" value={h} onChange={e=>setH(e.target.value)}/></Field>
        <Field label="Low"><input className="mono" placeholder="0.00" value={l} onChange={e=>setL(e.target.value)}/></Field>
        <Field label="Close"><input className="mono" placeholder="0.00" value={c} onChange={e=>setC(e.target.value)}/></Field>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginTop:10}}>
        <button className="btn" onClick={autofill} disabled={busy||!String(label||"").trim()} style={{padding:"7px 12px",fontSize:12.5}}>{busy?<span className="spin"/>:"⚡ Auto-fill H/L/C from "+(label||"ticker")}</button>
        <span className="mono" style={{fontSize:12,color:note?"var(--brass)":"var(--faint)"}}>{note||"Pulls the "+period.toLowerCase()+"'s high, low & close for free (Yahoo) — no AI."}</span>
      </div>

      <div style={{display:"flex",gap:4,marginTop:14,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9,padding:3,width:"fit-content"}}>
        {PIV_METHODS.map(m=>(
          <button key={m} onClick={()=>setMethod(m)} className="disp"
            style={{border:"none",padding:"7px 13px",fontSize:14,fontWeight:600,borderRadius:7,cursor:"pointer",
              background:method===m?"var(--bg3)":"transparent",color:method===m?"var(--brass)":"var(--dim)"}}>{m}</button>
        ))}
      </div>

      {!valid
        ? <div style={{marginTop:16,padding:16,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10,fontSize:14.5,color:"var(--dim)"}}>Enter High, Low and Close (High ≥ Low) to see the levels.</div>
        : <div style={{marginTop:16,border:"1px solid var(--line)",borderRadius:11,overflow:"hidden"}}>
            <div style={{padding:"8px 14px",background:"var(--bg2)",borderBottom:"1px solid var(--line)",fontSize:13}} className="mono">
              {label} · {period} · {method} pivots
            </div>
            {levels.map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid var(--line)",background:k==="PP"?"rgba(227,168,87,0.06)":"transparent"}}>
                <span className="mono" style={{fontSize:14,fontWeight:700,color:rowColor(k)}}>{k}</span>
                <span className="mono" style={{fontSize:15.5,fontWeight:600,color:"var(--bone)"}}>{v.toFixed(2)}</span>
              </div>
            ))}
          </div>}
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:10,lineHeight:1.5}}>
        Standard = floor-trader pivots · Fibonacci = fib-ratio R/S · Camarilla = tighter reversal levels (R3/S3 reversal, R4/S4 breakout).
      </div>
    </div>
  );
}

const SD_PRESETS=[["1","1 day"],["7","1 week"],["30","1 month"]];
function StdDevCalculator(){
  const [price,setPrice]=useState(""); const [iv,setIv]=useState(""); const [days,setDays]=useState("7");
  const [label,setLabel]=useState("IWM");
  const [busy,setBusy]=useState(false); const [note,setNote]=useState("");
  async function autofillPrice(){
    const s=String(label||"").trim().toUpperCase(); if(!s||busy) return;
    setBusy(true); setNote("");
    try{
      const r=await fetch(`/api/quotes?symbols=${encodeURIComponent(s)}`).then(x=>x.json()).catch(()=>null);
      const q=r&&r.quotes&&r.quotes[s];
      if(q&&q.price!=null){ setPrice(String(Math.round(q.price*100)/100)); setNote(`${s} @ $${q.price.toFixed(2)} — now enter IV from your chain`); }
      else setNote("No price — enter it manually.");
    }catch(e){ setNote("Couldn't fetch — enter manually."); }
    setBusy(false);
  }
  const P=num(price), IV=num(iv), D=num(days);
  const valid = P!=null&&P>0 && IV!=null&&IV>0 && D!=null&&D>0;
  let move=null, movePct=null, rows=[];
  if(valid){
    move = P*(IV/100)*Math.sqrt(D/365);
    movePct = move/P*100;
    rows=[["+2σ",P+2*move,"hi"],["+1σ",P+move,"hi"],["Price",P,"mid"],["−1σ",P-move,"lo"],["−2σ",P-2*move,"lo"]];
  }
  const rowColor=side=> side==="mid"?"var(--brass)": side==="hi"?"var(--bear)":"var(--bull)";
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Volatility · options</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Standard deviation & expected move</h3><Help text="From price, implied volatility (IV) and days, it projects the range price is statistically likely to stay in: ±1σ ≈ 68% of the time, ±2σ ≈ 95%. That's the move already priced into options — buying premium into an event only pays if the actual move BEATS ±1σ, or IV crush eats you."/></div>
      <p style={{margin:"0 0 14px",fontSize:14.5,color:"var(--dim)"}}>From price, implied volatility and days, this projects the range price is statistically likely to stay inside. ±1σ ≈ 68% of the time, ±2σ ≈ 95%. It's the move already priced into options — your event has to beat it to pay.</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
        <Field label="Ticker (label)"><input className="mono" value={label} onChange={e=>setLabel(e.target.value.toUpperCase())}/></Field>
        <Field label="Price"><input className="mono" placeholder="0.00" value={price} onChange={e=>setPrice(e.target.value)}/></Field>
        <Field label="Implied vol % (annual)"><input className="mono" placeholder="e.g. 22" value={iv} onChange={e=>setIv(e.target.value)}/></Field>
        <Field label="Days"><input className="mono" placeholder="7" value={days} onChange={e=>setDays(e.target.value)}/></Field>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginTop:10}}>
        <button className="btn" onClick={autofillPrice} disabled={busy||!String(label||"").trim()} style={{padding:"7px 12px",fontSize:12.5}}>{busy?<span className="spin"/>:"⚡ Auto-fill price from "+(label||"ticker")}</button>
        <span className="mono" style={{fontSize:12,color:note?"var(--brass)":"var(--faint)"}}>{note||"Price fills free (Yahoo). IV comes from your broker's option chain — not a free feed."}</span>
      </div>
      <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
        {SD_PRESETS.map(([v,l])=>(
          <button key={v} onClick={()=>setDays(v)} className="mono"
            style={{border:"1px solid "+(days===v?"var(--brass)":"var(--line2)"),background:"var(--bg)",color:days===v?"var(--brass)":"var(--dim)",
              borderRadius:7,padding:"5px 11px",fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      {!valid
        ? <div style={{marginTop:16,padding:16,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10,fontSize:14.5,color:"var(--dim)"}}>Enter price, IV % and days to see the standard-deviation range. (IV is the option's implied volatility — you'll see it on the options chain.)</div>
        : <>
            <div style={{marginTop:16,padding:"12px 15px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <span style={{fontSize:14.5,color:"var(--bone)"}}>Expected move (±1σ) over {D} day{D===1?"":"s"}</span>
              <span className="mono" style={{fontSize:16,fontWeight:700,color:"var(--brass)"}}>± {move.toFixed(2)} ({movePct.toFixed(1)}%)</span>
            </div>
            <div style={{marginTop:12,border:"1px solid var(--line)",borderRadius:11,overflow:"hidden"}}>
              <div className="mono" style={{padding:"8px 14px",background:"var(--bg2)",borderBottom:"1px solid var(--line)",fontSize:13}}>{label} · projected range</div>
              {rows.map(r=>(
                <div key={r[0]} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid var(--line)",background:r[2]==="mid"?"rgba(227,168,87,0.06)":"transparent"}}>
                  <span className="mono" style={{fontSize:14,fontWeight:700,color:rowColor(r[2])}}>{r[0]}</span>
                  <span className="mono" style={{fontSize:15.5,fontWeight:600,color:"var(--bone)"}}>{r[1].toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:10,lineHeight:1.5}}>
              ~68% of the time price stays within ±1σ, ~95% within ±2σ. Buying premium into an event only pays if the move beats ±1σ. Selling premium? A strike past ±1σ has roughly an 84% chance of expiring out of the money.
            </div>
          </>}
    </div>
  );
}

const SCREENERS=[
  {t:"Finviz screener", d:"Filter by volume, price vs. moving averages, optionable, sector", u:"https://finviz.com/screener.ashx"},
  {t:"Finviz sector map", d:"See which sectors & names are green/red right now", u:"https://finviz.com/map.ashx?t=sec"},
  {t:"TradingView screener", d:"Chart-native scans with your own criteria", u:"https://www.tradingview.com/screener/"},
  {t:"Barchart unusual options", d:"Where big options flow is hitting today", u:"https://www.barchart.com/options/unusual-activity/stocks"},
];
const FINDER_STEPS=[
  {k:"1 · Top-down from sectors", v:"Start on the Sectors tab. Trade names inside the leading sector for longs/calls, the lagging sector for shorts/puts. Strength flows from sector → name."},
  {k:"2 · Demand liquidity", v:"Only trade what's liquid: 1M+ average volume, tight bid/ask. For options, add tight option spreads and healthy open interest so you can actually get filled."},
  {k:"3 · Confirm continuity / structure", v:"Check the name has FTFC in your direction (Strat) or clean HTF structure with a fresh BOS/CHoCH (ICT). Skip the chop."},
  {k:"4 · Know the catalyst", v:"Earnings or news soon = bigger moves but IV-crush risk. Mark the date. Buying premium into an event only pays if the move beats the expected move."},
  {k:"5 · Level & magnitude", v:"Price should sit near a pivot or key level with real room (magnitude) to the next one. No room = no reward."},
  {k:"6 · Keep a focus list", v:"Trade a known circle of 10–20 names (your watchlist), not the whole market. Familiar behavior beats a fresh chart every day."},
];
function TickerFinder({watch,setWatch}){
  const [t,setT]=useState("");
  const add=()=>{const s=t.toUpperCase().trim(); if(s&&!watch.includes(s)) setWatch([...watch,s]); setT("");};
  const linkA={display:"block",padding:"12px 14px",borderRadius:10,border:"1px solid var(--line2)",textDecoration:"none",background:"var(--bg)"};
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Workflow</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>How to identify tickers</h3><Help text="A repeatable funnel for finding what to trade: start from the whole market, filter by sector rotation and structure, down to the 2–3 names actually worth a trade today. Plus screener links and a box to add tickers to your watchlist."/></div>
      <p style={{margin:"0 0 16px",fontSize:14.5,color:"var(--dim)"}}>A repeatable funnel — from the whole market down to the two or three names actually worth a trade today.</p>

      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        {FINDER_STEPS.map(s=>(
          <div key={s.k} style={{padding:"12px 14px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
            <div className="mono" style={{fontSize:13.5,fontWeight:700,color:"var(--brass)",marginBottom:4}}>{s.k}</div>
            <div style={{fontSize:14,lineHeight:1.55,color:"var(--dim)"}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="eyebrow" style={{marginBottom:10}}>Screeners</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginBottom:20}}>
        {SCREENERS.map(s=>(
          <a key={s.t} href={s.u} target="_blank" rel="noopener" style={linkA}>
            <div className="disp" style={{fontSize:15.5,fontWeight:700,color:"var(--focus)"}}>{s.t} ↗</div>
            <div style={{fontSize:13,color:"var(--dim)",marginTop:4,lineHeight:1.4}}>{s.d}</div>
          </a>
        ))}
      </div>

      <div className="eyebrow" style={{marginBottom:8}}>Found one? Add it to your watchlist</div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <input className="mono" style={{maxWidth:180}} placeholder="Ticker" value={t}
          onChange={e=>setT(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter")add();}}/>
        <button className="btn" onClick={add}>Add to watchlist</button>
      </div>
    </div>
  );
}

/* ============================ NEWS ============================ */
function News({watch}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [scope,setScope]=useState("watch");
  const [mode,setMode]=useState("free");   // free = Yahoo headlines (instant, no AI) · ai = AI wire (adds sentiment)

  const ago=(ts)=>{ if(!ts) return ""; const s=Math.max(0,(Date.now()-ts)/1000); if(s<60)return"just now"; const m=s/60; if(m<60)return Math.round(m)+"m ago"; const h=m/60; if(h<24)return Math.round(h)+"h ago"; return Math.round(h/24)+"d ago"; };

  async function loadFree(){
    setLoading(true); setErr(""); setItems([]);
    try{
      const qs = scope==="watch" ? `symbols=${encodeURIComponent((watch||[]).join(","))}` : "market=1";
      const r=await fetch(`/api/news?${qs}`);
      const j=await r.json();
      if(j&&Array.isArray(j.items)&&j.items.length) setItems(j.items.map(n=>({...n,free:true})));
      else setErr("No headlines came back — try again, or switch to the AI wire.");
    }catch(e){ setErr("Free feed failed. Check connection and retry."); }
    setLoading(false);
  }
  const pull=()=> (mode==="free"?loadFree():load());

  async function load(){
    setLoading(true); setErr("");
    try{
      const focus = scope==="watch" ? `these tickers: ${watch.join(", ")}` : "the broad US market (indices, Fed/rates, small caps, semiconductors/AI)";
      const data=await callClaude({ maxTokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}],
        system:"You are a market news wire. Search for the latest, most market-moving stories. Return ONLY a JSON array of 6-9 objects: {\"ticker\":\"SPY|NVDA|MKT etc\",\"headline\":string,\"summary\":one short sentence,\"sentiment\":\"bullish\"|\"bearish\"|\"neutral\",\"source\":string,\"time\":\"relative time\"}. No prose, no markdown fences. Rewrite headlines in your own words.",
        messages:[{role:"user",content:`Latest market-moving news for ${focus}. Today is ${todayISO()}. Prioritize the last 24-48h.`}]});
      const j=extractJson(getText(data));
      if(Array.isArray(j)) setItems(j); else setErr("Couldn't parse the news feed — try again.");
    }catch(e){ setErr("News load failed. Check connection and retry."); }
    setLoading(false);
  }

  const sCol=s=> s==="bullish"?"var(--bull)": s==="bearish"?"var(--bear)":"var(--dim)";
  return (
    <div>
      <div className="card" style={{padding:18,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <div className="eyebrow" style={{margin:0}}>Research</div>
        </div>
        <p style={{margin:"4px 0 0",fontSize:14,color:"var(--dim)",lineHeight:1.5}}>Enter any ticker for a full deep dive — institutional flow, news, timing patterns, thesis, and entry/exit windows.</p>
        <DeepDive allowInput/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <div className="eyebrow" style={{margin:0}}>News wire</div>
        <Help text="Latest market-moving headlines. Two sources: 'Free feed' pulls real headlines from Yahoo Finance instantly with ZERO AI cost (publisher + time, tap to open the article); 'AI wire' uses an AI web search that rewrites headlines and adds a bull/bear tag (costs one AI call). Toggle 'My watchlist' or 'Broad market' for either. Best-effort and delayed — verify anything you'd trade on."/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:9,padding:3}}>
          {[["free","⚡ Free feed"],["ai","🧠 AI wire"]].map(([id,l])=>(
            <button key={id} onClick={()=>{setMode(id); setItems([]); setErr("");}} className="disp"
              style={{border:"none",padding:"7px 13px",fontSize:14,fontWeight:600,borderRadius:7,
                background:mode===id?"var(--bg3)":"transparent",color:mode===id?"var(--brass)":"var(--dim)"}}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:9,padding:3}}>
          {[["watch","My watchlist"],["market","Broad market"]].map(([id,l])=>(
            <button key={id} onClick={()=>setScope(id)} className="disp"
              style={{border:"none",padding:"7px 13px",fontSize:14,fontWeight:600,borderRadius:7,
                background:scope===id?"var(--bg3)":"transparent",color:scope===id?"var(--brass)":"var(--dim)"}}>{l}</button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <button className="btn-primary btn" onClick={pull} disabled={loading}>{loading?<span className="spin"/>:(mode==="free"?"⚡ Get headlines":"🧠 Pull latest news")}</button>
      </div>
      <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:-6,marginBottom:14}}>{mode==="free"?"Free · from Yahoo Finance · no AI tokens used":"AI web search · adds sentiment · uses one AI call"}</div>
      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginBottom:10}}>{err}</div>}

      {items.length===0 && !loading &&
        <div className="card" style={{padding:30,textAlign:"center"}}>
          <p style={{margin:0,color:"var(--dim)",fontSize:15}}>Pull the wire for {scope==="watch"?"your watchlist":"the broad market"}. Headlines are searched live and summarized — always confirm before you trade on them.</p>
        </div>}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {items.map((it,i)=>(
          <div key={i} className="card" style={{padding:15}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:6,flexWrap:"wrap"}}>
              <span className="mono" style={{fontWeight:700,fontSize:13.5,color:"var(--brass)"}}>{it.ticker||"MKT"}</span>
              {!it.free && <span className="tag" style={{color:sCol(it.sentiment),borderColor:"var(--line2)"}}>{it.sentiment||"neutral"}</span>}
              <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>{it.source}{(it.time||it.ts)?" · "+(it.free?ago(it.ts):it.time):""}</span>
            </div>
            {it.free && it.link
              ? <a href={it.link} target="_blank" rel="noopener" className="disp" style={{fontSize:15,fontWeight:600,lineHeight:1.3,color:"var(--bone)",textDecoration:"none",display:"block"}}>{it.headline} <span style={{color:"var(--focus)",fontSize:13}}>↗</span></a>
              : <div className="disp" style={{fontSize:15,fontWeight:600,lineHeight:1.3,marginBottom:5}}>{it.headline}</div>}
            {it.summary && <div style={{fontSize:14.5,color:"var(--dim)",lineHeight:1.5,marginTop:5}}>{it.summary}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ PLAYBOOK (Coach + Strat reference) ============================ */
const STUDY_ITEMS=[
  {id:"ms", title:"Market structure", sub:"swing points · HH/HL/LH/LL · BOS · CHoCH · MSS",
   def:"The sequence of swing highs and lows price leaves behind. Higher highs + higher lows = uptrend; lower highs + lower lows = downtrend. A break in the trend direction is a BOS (continuation); the first break against it is a CHoCH, confirmed by an MSS with displacement. Learn this first — every other concept sits on top of it.",
   videos:[{t:"BoS vs CHoCH, made simple", u:"https://www.youtube.com/watch?v=FE1bgD9N6DM"}]},
  {id:"mmbm", title:"Market Maker Buy Model (MMBM)", sub:"the bullish campaign blueprint",
   def:"Consolidation → a sell program runs sellside liquidity down to a discount low → smart-money reversal → a buy program marks price up through buyside liquidity. The point: be the buyer at the low, not the chaser at the top.",
   videos:[{t:"ICT Market Maker Model — in depth", u:"https://www.youtube.com/watch?v=uSFxr4jT230"},{t:"Both models in 12 min", u:"https://www.youtube.com/watch?v=KYluOSDaEys"}]},
  {id:"mmsm", title:"Market Maker Sell Model (MMSM)", sub:"the bearish mirror of MMBM",
   def:"The inverse: consolidation → a buy program lifts price into premium and runs buyside liquidity → smart-money reversal at the high → a sell program marks price down through sellside liquidity. Be the seller / put-buyer at the high.",
   videos:[{t:"Market maker models, step by step", u:"https://www.youtube.com/watch?v=yRjtncZM2h8"}]},
  {id:"liq", title:"Liquidity, FVG, order blocks & premium/discount", sub:"the parts the models run on",
   def:"Liquidity = stops resting above highs / below lows that price hunts. FVG = a 3-candle imbalance price returns to fill. Order block = the last opposing candle before a strong move. Premium/discount = sell the top half of a range, buy the bottom half, split at the 50% equilibrium.",
   videos:[{t:"Every ICT concept in 17 min", u:"https://www.youtube.com/watch?v=QQijkhheJ9g"}]},
  {id:"ictvid", title:"Watch the ICT (Inner Circle Trader) series", sub:"the original source, free on YouTube",
   def:"Michael Huddleston released his full mentorship free. It's the source these concepts come from. Start with the 2022 Mentorship for the core model, then the newer lectures. He's long-winded — watch at 1.5× and take notes.",
   videos:[{t:"ICT official channel", u:"https://www.youtube.com/@InnerCircleTrader"}]},
  {id:"strat1", title:"The Strat — bar types & actionable signals", sub:"Rob Smith's 1 / 2 / 3 system",
   def:"Every candle is a 1 (inside / consolidation), 2 (directional — took one side of the prior bar), or 3 (outside — took both). Combos like 2-1-2, 3-1-2 and 1-2-2 are your actionable triggers; you enter on the break of the prior bar's high or low.",
   videos:[{t:"Rob Smith — How to trade The Strat", u:"https://www.youtube.com/watch?v=36gsWBNpXz8"}]},
  {id:"strat2", title:"The Strat — FTFC & pivots", sub:"the timeframe filter + your targets",
   def:"Full Time Frame Continuity is the 'magic sauce': when month / week / day / hour all point the same way (all above or below their opens), you're trading the strongest signals with the crowd. Pivots (prior swing highs/lows) are your triggers and targets; magnitude is the room to the next pivot.",
   videos:[{t:"FTFC: control or conflict", u:"https://www.youtube.com/watch?v=O28St2jI8ww"}]},
  {id:"mm", title:"Money management — size off stop, IV crush, R", sub:"your reinforcement zone",
   def:"The survival layer. Size off your stop (size = risk$ ÷ [entry − stop]), think in R (reward ÷ risk), and respect IV crush: after earnings/Fed, volatility collapses and can wipe a long option even when your direction is right.",
   videos:[{t:"Why your calls lose when the stock rises (IV crush)", u:"https://www.youtube.com/watch?v=v846B7hs9xg"},{t:"Position size & risk per trade", u:"https://www.youtube.com/watch?v=Lh-_tATmUpk"}]},
  {id:"strategy", title:"Market strategy — write & backtest a playbook", sub:"turn concepts into a tested edge",
   def:"Combine everything into a written playbook — setup, trigger, stop, target, risk — then backtest it bar-by-bar on history so you trust it before risking capital. Aim for 100+ sample trades and a profit factor above ~1.5.",
   videos:[{t:"Backtesting, step by step", u:"https://www.youtube.com/watch?v=sISUgclLYj0"}]},
];
function StudyList(){
  const [done,setDone]=useState({});
  const [ready,setReady]=useState(false);
  useEffect(()=>{(async()=>{const d=await sGet("study:progress"); if(d&&typeof d==="object")setDone(d); setReady(true);})();},[]);
  useEffect(()=>{ if(ready) sSet("study:progress",done); },[done,ready]);
  const toggle=id=>setDone(d=>({...d,[id]:!d[id]}));
  const n=STUDY_ITEMS.filter(i=>done[i.id]).length; const pct=Math.round(n/STUDY_ITEMS.length*100);
  const vidChip={display:"inline-flex",alignItems:"center",gap:6,fontFamily:"'JetBrains Mono',monospace",fontSize:12.5,fontWeight:600,
    padding:"6px 10px",borderRadius:7,border:"1px solid var(--line2)",color:"#E8756A",textDecoration:"none",background:"var(--bg2)"};
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div>
          <div className="eyebrow" style={{marginBottom:4}}>Learning path</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>What to learn — and where to learn it</h3><Help text="Your study roadmap — the core concepts (market structure, Strat bar types, FTFC, the Greeks, ICT) in the order to learn them, each with a real video/resource link. Check items off as you master them; it feeds your Progress tracker."/></div>
        </div>
        <div className="mono" style={{fontSize:14.5,color:"var(--brass)",fontWeight:600}}>{n}/{STUDY_ITEMS.length} · {pct}%</div>
      </div>
      <div style={{height:6,background:"var(--bg)",borderRadius:6,margin:"12px 0 18px",overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:"var(--brass)",transition:"width .3s"}}/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {STUDY_ITEMS.map(it=>{
          const on=!!done[it.id];
          return (
            <div key={it.id} style={{padding:"14px 15px",borderRadius:11,background:"var(--bg)",border:"1px solid "+(on?"var(--brass-dim)":"var(--line)")}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <button onClick={()=>toggle(it.id)} title="Mark learned"
                  style={{marginTop:1,width:20,height:20,flexShrink:0,borderRadius:6,cursor:"pointer",
                    border:"1.5px solid "+(on?"var(--brass)":"var(--line2)"),background:on?"var(--brass)":"transparent",
                    color:"#241A0A",fontSize:14.5,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{on?"✓":""}</button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                    <span className="disp" style={{fontSize:15,fontWeight:700,color:on?"var(--dim)":"var(--bone)"}}>{it.title}</span>
                    <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>{it.sub}</span>
                  </div>
                  <p style={{margin:"7px 0 0",fontSize:14,lineHeight:1.55,color:"var(--dim)"}}>{it.def}</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:11}}>
                    {it.videos.map((v,i)=>(
                      <a key={i} href={v.u} target="_blank" rel="noopener" style={vidChip}>▶ {v.t}</a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:14,lineHeight:1.5}}>
        ▶ links open YouTube in a new tab. Every term here is defined in the glossary below. Check items off as you master them — progress saves automatically.
      </div>
    </div>
  );
}

/* ============================ TUTOR (progress + chat) ============================ */
const JRNL_MILES=[10,25,50,100,250];
const TUTOR_RANKS=[[0,"Getting started"],[20,"Building basics"],[45,"Finding your edge"],[75,"Dialed in"],[110,"Sharp"]];
const COACH_KB_SEED=[
  {id:"kb-style",title:"Trading style",content:"Trades IWM primarily (plus AI/semis and select names) using The Strat + options. Reads top-down: Daily/60m for bias, and 5m/15m/30m for triggers (I watch 5m, 15m, 30m, 1H, daily, weekly, monthly). Mostly buys directional calls/puts; day-trades and some swings."},
  {id:"kb-pipeline",title:"6-step trade pipeline",content:"1) Bias from structure 2) Check FTFC 3) Mark the pivot (prior bar high/low) 4) Wait for the trigger (break of prior bar) 5) Stop just past the trigger, size OFF the stop 6) Target the next pivot and take it. No trigger = no trade."},
  {id:"kb-contracts",title:"Contract selection defaults",content:"Delta 0.55–0.70, ATM or one strike ITM, liquid strikes (tight spread, real volume). Day trades 3–5 DTE; swings 30–60 DTE. Avoid far-OTM cheap lottos."},
  {id:"kb-scaleout",title:"Core lesson — scale out",content:"Take profit in pieces into strength (learned 7/31 on the IWM 292 call: +16/+35/+21). This is the fix for the biggest leak. Bank at each level; don't hold for a home run."},
  {id:"kb-leak",title:"The leak to avoid",content:"Far-OTM / held-to-expiration lottos are the account killer. CRWV $160 call (−$253, expired worthless) and IWM $292 put (−$100, expired) = ~60% of all losses in two trades. Never let a long option ride to zero; use a stop."},
  {id:"kb-0dte",title:"0DTE timing trap",content:"On expiration day, Robinhood auto-closes at-risk expiring long options starting ~3:30 PM ET at their price. Close the last piece yourself before 3:30. Prefer not to trade 0DTE far-OTM."},
  {id:"kb-iwm",title:"IWM behavior",content:"IWM = iShares Russell 2000 ETF (BlackRock, ~$79B, ~2000 small caps, each <0.4%). No single name drives it — it's a macro basket that moves on rates, growth and risk sentiment. Reacts hard to ISM and the jobs report."},
  {id:"kb-bias",title:"Current IWM bias (Aug 2026)",content:"Bearish — lower highs/lower lows in a descending channel since the ~304 July peak; price ~289.82. Short trigger: bounce into 292–294 + 2-down, or break-and-hold below 287–288. Invalidation: reclaim & hold above ~294. Targets: 287–288 → 284 → 282."},
  {id:"kb-volume",title:"Reading volume",content:"Expansion confirms, contraction warns, climax exhausts. Want a breakdown on an above-average red bar; a bounce to short into on light volume. For options, trade liquid near-money strikes so you can scale in/out."},
];
function TeachCoach(){
  const [kb,setKb]=useState([]);
  const [ready,setReady]=useState(false);
  const [title,setTitle]=useState(""); const [content,setContent]=useState("");
  const [show,setShow]=useState(false);
  const [feed,setFeed]=useState(""); const [src,setSrc]=useState("");
  const [learning,setLearning]=useState(false); const [learnErr,setLearnErr]=useState(""); const [learned,setLearned]=useState(null);
  useEffect(()=>{(async()=>{ const l=await sGet("coach:kb"); if(Array.isArray(l)) setKb(l); setReady(true); })();},[]);
  useEffect(()=>{ if(ready) sSet("coach:kb",kb); },[kb,ready]);
  function add(){ if(!content.trim()) return; setKb(x=>[{id:Date.now()+"",title:title.trim()||"Note",content:content.trim()},...x]); setTitle(""); setContent(""); }
  function del(id){ setKb(x=>x.filter(i=>i.id!==id)); }
  async function learn(){
    const text=feed.trim(); if(!text||learning) return;
    setLearning(true); setLearnErr(""); setLearned(null);
    try{
      const res=await callClaude({ maxTokens:1000,
        system:"You distill trading education into a knowledge base for a specific trader (The Strat + options, IWM-focused, learning ICT). From the material (a video transcript, article, or notes), extract only the most useful, ACTIONABLE lessons and rules. Return ONLY a JSON array of 3-6 objects {\"title\":\"short label\",\"content\":\"1-2 sentence rule in plain language\"}. No prose, no markdown fences. Skip fluff, intros, and self-promo — keep only what changes how they trade or think.",
        messages:[{role:"user",content:(src?("Source: "+src+"\n\n"):"")+text.slice(0,9000)}]});
      const j=extractJson(getText(res));
      if(Array.isArray(j)&&j.length){
        const items=j.map(x=>({id:Date.now()+"-"+Math.random().toString(36).slice(2,6),title:String(x.title||"Lesson").slice(0,90),content:String(x.content||"").slice(0,400),src:src||undefined})).filter(x=>x.content);
        setKb(prev=>[...items,...prev]); setLearned(items.length); setFeed(""); setSrc("");
      } else setLearnErr("Couldn't pull clean lessons — paste a bit more, or add one manually below.");
    }catch(e){ setLearnErr(aiErr(e,"Learn")); }
    setLearning(false);
  }
  const fld={fontFamily:"inherit",background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--bone)",borderRadius:8,padding:"9px 11px",fontSize:14.5,width:"100%",outline:"none"};
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div><div className="eyebrow" style={{marginBottom:4}}>Your agent</div><div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Train the coach — it learns what you feed it</h3><Help text="Feed it a video transcript, article, or notes and it distills the key rules into its brain — used in every Tutor and per-trade answer after that. It coaches from YOUR playbook, not generic advice. Add facts manually too."/></div></div>
        <span className="mono" style={{fontSize:13.5,fontWeight:700,color:"var(--brass)"}}>{kb.length} learned</span>
      </div>
      <p style={{margin:"10px 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.55}}>Everything the agent learns is fed into the Tutor and every per-trade chat automatically, so it coaches from <b style={{color:"var(--bone)"}}>your</b> playbook — not generic advice.</p>

      {/* AUTO-LEARN from transcript / notes */}
      <div style={{padding:"14px",background:"rgba(227,168,87,0.05)",border:"1px solid var(--brass-dim)",borderRadius:12,marginBottom:14}}>
        <div className="eyebrow" style={{marginBottom:8,color:"var(--brass)"}}>Feed it material · it distills the lessons</div>
        <input style={{...fld,marginBottom:8}} placeholder="Source (optional) — e.g. ICT market structure video" value={src} onChange={e=>setSrc(e.target.value)}/>
        <textarea rows={4} style={{...fld,resize:"vertical"}} placeholder="Paste a video transcript, article, or your notes here…" value={feed} onChange={e=>setFeed(e.target.value)}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:10,flexWrap:"wrap"}}>
          <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>{feed.trim().length>0?`${feed.trim().length} chars`:"Paste text — the agent pulls out 3–6 rules"}</span>
          <button className="btn-primary btn" onClick={learn} disabled={learning||!feed.trim()}>{learning?<span className="spin"/>:"Learn this"}</button>
        </div>
        {learnErr && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:8}}>{learnErr}</div>}
        {learned && <div style={{color:"var(--bull)",fontSize:14,marginTop:8}}>✓ Learned {learned} new {learned===1?"lesson":"lessons"} — the agent now uses {learned===1?"it":"them"} in every answer.</div>}
      </div>

      {/* MANUAL add */}
      <div className="eyebrow" style={{marginBottom:8}}>Or add one fact yourself</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:10}}>
        <input style={fld} placeholder="Title (e.g. My A+ setup)" value={title} onChange={e=>setTitle(e.target.value)}/>
        <textarea rows={2} style={{...fld,resize:"vertical"}} placeholder="A rule, lesson, or do/don't the coach should always remember" value={content} onChange={e=>setContent(e.target.value)}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        {kb.length>0 && <button className="btn-ghost btn" onClick={()=>setShow(s=>!s)}>{show?"Hide brain":"Show its brain"}</button>}
        <button className="btn-primary btn" onClick={add}>Teach it</button>
      </div>

      {show &&
        <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
          {kb.map(k=>(
            <div key={k.id} style={{padding:"10px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:9,display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div className="disp" style={{fontSize:14.5,fontWeight:700,color:"var(--brass)"}}>{k.title}</div>
                <div style={{fontSize:13.5,color:"var(--dim)",marginTop:3,lineHeight:1.5}}>{k.content}</div>
                {k.src && <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:4}}>from: {k.src}</div>}
              </div>
              <button onClick={()=>del(k.id)} style={{background:"none",border:"none",color:"var(--faint)",fontSize:15,cursor:"pointer"}} title="Remove">×</button>
            </div>
          ))}
        </div>}
    </div>
  );
}

/* ---------- Course: sequential lessons, each with its own test ---------- */
const LESSONS=[
  {n:1,title:"The bars — Strat foundations",blurb:"How every candle reads against the one before it: inside, 2-up, 2-down, outside.",cats:["Bar types"]},
  {n:2,title:"Actionable signals",blurb:"The bar combinations worth trading — 2-1-2, 3-1-2, 1-2-2, failed 2s.",cats:["Actionable signals"]},
  {n:3,title:"Continuity & FTFC",blurb:"Full-timeframe continuity and the environment you enter into.",cats:["Strat continuity scans","FTFC & structure"]},
  {n:4,title:"Market structure & liquidity",blurb:"Swings, HH/HL, BOS, CHoCH, and where the stops rest.",cats:["Market structure"]},
  {n:5,title:"How price is engineered — ICT",blurb:"Market-maker models, fair-value gaps, order blocks, OTE, premium/discount.",cats:["Market-maker models · ICT"]},
  {n:6,title:"Triggers, pivots & your risk system",blurb:"Where you get in, where you're wrong, and how you size it.",cats:["Triggers & pivots","Your risk system"]},
  {n:7,title:"The Greeks",blurb:"Delta, gamma, theta, vega — what moves your contract besides direction.",cats:["Options Greeks"]},
  {n:8,title:"Options risk & pricing",blurb:"IV, IV crush, expected move, moneyness, and the chain you fill on.",cats:["Options risk & terms","Options pricing & execution"]},
  {n:9,title:"Money, journal & discipline",blurb:"Sizing off the stop, R-multiples, and the numbers that measure you.",cats:["Money management","Journal metrics"]},
  {n:10,title:"Trend tools & the open",blurb:"EMAs, VWAP, ORB, pivots, volume, and the overnight futures tone.",cats:["Moving averages, VWAP & trend tools","Pivot indicators & horizon","Reading volume","Futures & the open"]},
];
function lessonItems(les){ const set=new Set(les.cats); const out=[]; GLOSSARY.forEach(g=>{ if(set.has(g.cat)) g.items.forEach(it=>out.push({term:it.term,def:it.def,cat:g.cat,dia:it.dia})); }); return out; }
function questionsFrom(items,n){
  const allT=testBank(0);
  return tShuffle(items).slice(0,n).map(t=>{
    let d=tShuffle(allT.filter(x=>x.cat===t.cat&&x.term!==t.term)).slice(0,3).map(x=>x.term);
    if(d.length<3) d=d.concat(tShuffle(allT.filter(x=>x.term!==t.term&&!d.includes(x.term))).slice(0,3-d.length).map(x=>x.term));
    return {prompt:stripHtml(t.def), answer:t.term, options:tShuffle([t.term,...d.slice(0,3)]), cat:t.cat, dia:t.dia};
  });
}
function Quiz({questions,onDone}){
  const [i,setI]=useState(0), [picked,setPicked]=useState(null), [answers,setAnswers]=useState([]);
  const q=questions[i]; if(!q) return null;
  const score=answers.filter(a=>a&&a.correct).length;
  const btn={border:"1px solid var(--line2)",background:"var(--bg)",color:"var(--bone)",borderRadius:10,padding:"12px 14px",fontSize:15,cursor:"pointer",textAlign:"left",fontFamily:"inherit",width:"100%",display:"flex",alignItems:"center",gap:10};
  function choose(opt){ if(picked!=null)return; setPicked(opt); setAnswers(a=>{ const c=a.slice(); c[i]={correct:opt===q.answer,term:q.answer,dia:q.dia,prompt:q.prompt}; return c; }); }
  function next(){ if(i+1<questions.length){ setI(i+1); setPicked(null); } else { const arr=answers.slice(); onDone(arr.filter(a=>a&&a.correct).length, questions.length, arr.filter(a=>a&&!a.correct)); } }
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <span className="eyebrow">Q{i+1} of {questions.length}</span>
        <span className="mono" style={{marginLeft:"auto",fontSize:13,color:"var(--brass)"}}>Score {score}/{answers.filter(Boolean).length}</span>
      </div>
      <div style={{height:5,background:"var(--bg3)",borderRadius:3,marginBottom:14,overflow:"hidden"}}><div style={{height:"100%",width:`${(i/questions.length)*100}%`,background:"var(--brass)"}}/></div>
      <div className="card" style={{padding:18,marginBottom:12}}>
        <div className="eyebrow" style={{marginBottom:8}}>Which term is this?</div>
        <div style={{fontSize:16,color:"var(--bone)",lineHeight:1.55,fontWeight:500}}>{q.prompt}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {q.options.map((opt,k)=>{ const isAns=opt===q.answer,isP=opt===picked,show=picked!=null;
          const bc=show&&isAns?"var(--bull)":show&&isP&&!isAns?"var(--bear)":"var(--line2)";
          const bg=show&&isAns?"rgba(63,183,130,0.10)":show&&isP&&!isAns?"rgba(231,106,91,0.10)":"var(--bg)";
          return (<button key={k} onClick={()=>choose(opt)} disabled={show} style={{...btn,borderColor:bc,background:bg,cursor:show?"default":"pointer"}}>
            <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>{String.fromCharCode(65+k)}</span>
            <span style={{fontSize:15,fontWeight:600,color:show&&isAns?"var(--bull)":"var(--bone)"}}>{opt}</span>
            {show&&isAns&&<span style={{marginLeft:"auto",color:"var(--bull)"}}>✓</span>}
            {show&&isP&&!isAns&&<span style={{marginLeft:"auto",color:"var(--bear)"}}>✗</span>}
          </button>);
        })}
      </div>
      {picked!=null && <div className="card" style={{padding:15,marginTop:12,borderColor:picked===q.answer?"var(--bull)":"var(--bear)"}}>
        <div style={{fontSize:14,fontWeight:700,color:picked===q.answer?"var(--bull)":"var(--bear)",marginBottom:6}}>{picked===q.answer?"Correct":`It's ${q.answer}`}</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.5}}>{q.prompt}</div>
        {q.dia && <StratDia kind={q.dia}/>}
        <button className="btn btn-primary" onClick={next} style={{marginTop:12,padding:"9px 16px"}}>{i+1<questions.length?"Next →":"Finish →"}</button>
      </div>}
    </div>
  );
}
function Curriculum(){
  const [view,setView]=useState("index");   // index | lesson | test | result
  const [cur,setCur]=useState(0);
  const [prog,setProg]=useState({read:{},scores:{}});
  const [quizQs,setQuizQs]=useState([]);
  const [result,setResult]=useState(null);
  useEffect(()=>{ (async()=>{ const p=await sGet("course:progress"); if(p&&p.read) setProg({read:p.read||{},scores:p.scores||{}}); })(); },[]);
  const save=p=>{ setProg(p); sSet("course:progress",p); };
  const openLesson=k=>{ setCur(k); save({...prog,read:{...prog.read,[LESSONS[k].n]:true}}); setView("lesson"); };
  const openTest=k=>{ setCur(k); const it=lessonItems(LESSONS[k]); setQuizQs(questionsFrom(it,Math.min(10,it.length))); setResult(null); setView("test"); };
  const onDone=(score,total,missed)=>{ const pct=Math.round(score/total*100); const key=LESSONS[cur].n; save({...prog,scores:{...prog.scores,[key]:Math.max(prog.scores[key]||0,pct)}}); setResult({score,total,pct,missed}); setView("result"); };
  const doneCount=LESSONS.filter(l=>prog.scores[l.n]!=null).length;

  if(view==="lesson"){ const les=LESSONS[cur], items=lessonItems(les);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <button className="btn" onClick={()=>setView("index")} style={{padding:"6px 12px",fontSize:12.5}}>← All lessons</button>
          <span className="eyebrow">Lesson {les.n} of {LESSONS.length}</span>
        </div>
        <div className="card" style={{padding:20,marginBottom:16}}>
          <div className="eyebrow" style={{marginBottom:5}}>Lesson {les.n}</div>
          <div className="disp" style={{fontSize:24,fontWeight:800,marginBottom:7}}>{les.title}</div>
          <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.6}}>{les.blurb}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14,marginBottom:16}}>
          {items.map((it,j)=>(
            <div key={j} className="card" style={{padding:"15px 17px"}}>
              <div className="gloss-term" style={{marginBottom:5}}>{it.term}</div>
              <div className="gloss-def" dangerouslySetInnerHTML={{__html:it.def}}/>
              {it.dia && <StratDia kind={it.dia}/>}
            </div>))}
        </div>
        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
          <button className="btn btn-primary" onClick={()=>openTest(cur)} style={{padding:"11px 18px",fontSize:15}}>Take the Lesson {les.n} test →</button>
          {cur+1<LESSONS.length && <button className="btn" onClick={()=>openLesson(cur+1)} style={{padding:"11px 18px",fontSize:15}}>Skip to Lesson {les.n+1} →</button>}
        </div>
      </div>
    );
  }
  if(view==="test"){ const les=LESSONS[cur];
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <button className="btn" onClick={()=>setView("index")} style={{padding:"6px 12px",fontSize:12.5}}>← All lessons</button>
          <button className="btn" onClick={()=>openLesson(cur)} style={{padding:"6px 12px",fontSize:12.5}}>Re-read lesson</button>
          <span className="eyebrow">Lesson {les.n} test · {les.title}</span>
        </div>
        <Quiz key={les.n+"-"+quizQs.length} questions={quizQs} onDone={onDone}/>
      </div>
    );
  }
  if(view==="result"){ const les=LESSONS[cur], [gr,gc]=testGrade(result.pct);
    return (
      <div>
        <div className="card" style={{padding:24,marginBottom:16,textAlign:"center"}}>
          <div className="eyebrow" style={{marginBottom:6}}>Lesson {les.n} test · complete</div>
          <div className="mono" style={{fontSize:56,fontWeight:800,lineHeight:1,color:gc}}>{gr}</div>
          <div className="mono" style={{fontSize:19,fontWeight:800,marginTop:6}}>{result.score}/{result.total} · {result.pct}%</div>
          <div style={{display:"flex",gap:9,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>
            <button className="btn btn-primary" onClick={()=>openTest(cur)} style={{padding:"9px 16px"}}>↻ Retake</button>
            <button className="btn" onClick={()=>openLesson(cur)} style={{padding:"9px 16px"}}>Re-read lesson</button>
            {cur+1<LESSONS.length
              ? <button className="btn" onClick={()=>openLesson(cur+1)} style={{padding:"9px 16px",borderColor:"var(--brass)",color:"var(--brass)"}}>Next: Lesson {les.n+1} →</button>
              : <button className="btn" onClick={()=>setView("index")} style={{padding:"9px 16px"}}>Back to lessons</button>}
          </div>
        </div>
        {result.missed.length>0 && <div className="card" style={{padding:18}}>
          <div className="eyebrow" style={{marginBottom:10}}>Review these</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
            {result.missed.map((a,k)=>(<div key={k} style={{padding:13,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11}}>
              <div className="gloss-term" style={{marginBottom:5}}>{a.term}</div>
              <div style={{fontSize:13.5,color:"var(--comp)",lineHeight:1.5}}>{a.prompt}</div>
              {a.dia && <StratDia kind={a.dia}/>}
            </div>))}
          </div>
        </div>}
      </div>
    );
  }
  // ---- INDEX ----
  return (
    <div>
      <div className="card" style={{padding:20,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}><div className="eyebrow" style={{margin:0}}>The course</div><Help text="Ten lessons in order, each with its own test. Read a lesson (every concept shown with its diagram), then take the test on it — you're graded and shown what to review. Both the lesson and its test stay here for reference. Your best score per lesson is saved."/></div>
        <div className="disp" style={{fontSize:25,fontWeight:800,marginBottom:8}}>Learn it start to finish</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.65,marginBottom:12}}>Work through the lessons in order. Read the lesson, then take its test. Both stay linked here so you can come back to any lesson or retake any test.</div>
        <div style={{height:7,background:"var(--bg3)",borderRadius:5,overflow:"hidden"}}><div style={{height:"100%",width:`${doneCount/LESSONS.length*100}%`,background:"var(--brass)"}}/></div>
        <div className="mono" style={{fontSize:12.5,color:"var(--faint)",marginTop:7}}>{doneCount} of {LESSONS.length} lessons tested</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {LESSONS.map((l,k)=>{ const read=prog.read[l.n], sc=prog.scores[l.n];
          return (
          <div key={l.n} className="card" style={{padding:"13px 15px",display:"flex",alignItems:"center",gap:13,flexWrap:"wrap"}}>
            <div className="mono" style={{fontSize:15,fontWeight:800,color:sc!=null?testGrade(sc)[1]:"var(--faint)",width:30,textAlign:"center",flexShrink:0}}>{sc!=null?testGrade(sc)[0]:l.n}</div>
            <div style={{flex:"1 1 200px",minWidth:0}}>
              <div className="disp" style={{fontSize:16,fontWeight:700,color:"var(--bone)"}}>Lesson {l.n}: {l.title}</div>
              <div style={{fontSize:12.5,color:"var(--dim)",lineHeight:1.45,marginTop:2}}>{l.blurb}</div>
            </div>
            {sc!=null && <span className="mono" style={{fontSize:12.5,color:testGrade(sc)[1]}}>best {sc}%</span>}
            {read && sc==null && <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>read</span>}
            <div style={{display:"flex",gap:7}}>
              <button className="btn" onClick={()=>openLesson(k)} style={{padding:"7px 13px",fontSize:13}}>Lesson</button>
              <button className="btn btn-primary" onClick={()=>openTest(k)} style={{padding:"7px 13px",fontSize:13}}>Test</button>
            </div>
          </div>);
        })}
      </div>
    </div>
  );
}
function Tutor({trades}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <Curriculum/>
      <ProgressCounter trades={trades}/>
      <LessonsCard/>
      <TeachCoach/>
      <TutorChat/>
    </div>
  );
}
function ProgressCounter({trades}){
  const [learned,setLearned]=useState(0);
  useEffect(()=>{(async()=>{ const d=await sGet("study:progress"); const n=(d&&typeof d==="object")?STUDY_ITEMS.filter(i=>d[i.id]).length:0; setLearned(n); })();},[]);
  const total=STUDY_ITEMS.length;
  const learnPct=Math.round(learned/total*100);
  const n=(trades||[]).length;
  const nextMile=JRNL_MILES.find(m=>m>n)||null;
  const prevMile=[...JRNL_MILES].reverse().find(m=>m<=n)||0;
  const milePct=nextMile?Math.round((n-prevMile)/(nextMile-prevMile)*100):100;
  const pts=learned*10+Math.min(n,100);
  const rank=[...TUTOR_RANKS].reverse().find(r=>pts>=r[0])[1];
  const bar=(pct,color)=>(<div style={{height:8,background:"var(--bg2)",borderRadius:6,overflow:"hidden",marginTop:10}}><div style={{height:"100%",width:Math.max(0,Math.min(100,pct))+"%",background:color,transition:"width .3s"}}/></div>);
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Your learning tracker</h3><Help text="Tracks how far you've come: how many charting/Strat concepts you've checked off in the Playbook learning path, and how many trades you've journaled toward the next milestone. The rank badge levels up as both climb."/></div>
        <span className="mono" style={{fontSize:12.5,fontWeight:700,color:"#241A0A",background:"var(--brass)",padding:"5px 11px",borderRadius:20}}>{rank}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
        <div style={{padding:15,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:12}}>
          <div className="eyebrow" style={{marginBottom:8}}>Charting & concepts</div>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <span className="mono" style={{fontSize:30,fontWeight:800,color:"var(--brass)",lineHeight:1}}>{learned}</span>
            <span className="mono" style={{fontSize:15.5,color:"var(--dim)"}}>/ {total} learned</span>
            <span className="mono" style={{fontSize:14.5,color:"var(--dim)",marginLeft:"auto"}}>{learnPct}%</span>
          </div>
          {bar(learnPct,"var(--brass)")}
          <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:8}}>Check items off in the learning path below.</div>
        </div>
        <div style={{padding:15,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:12}}>
          <div className="eyebrow" style={{marginBottom:8}}>Trades journaled</div>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <span className="mono" style={{fontSize:30,fontWeight:800,color:"var(--focus)",lineHeight:1}}>{n}</span>
            <span className="mono" style={{fontSize:15.5,color:"var(--dim)"}}>logged</span>
            <span className="mono" style={{fontSize:14.5,color:"var(--dim)",marginLeft:"auto"}}>{nextMile?"→ "+nextMile:"max"}</span>
          </div>
          {bar(milePct,"var(--focus)")}
          <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:8}}>{nextMile?(nextMile-n)+" more to your next milestone.":"Milestone maxed — keep the streak going."}</div>
        </div>
      </div>
    </div>
  );
}

const MENTOR_SYS=`You are an elite trading mentor, analyst, and coach. You operate as if you carry the combined discipline of the greatest traders in history — applying their documented principles, never impersonating them: Edward Thorp (everything is probability & edge; quantify odds; size off risk; act only when the math favors you), Jim Simons (data & base rates over gut; repeatable statistical edges; keep ego out), Paul Tudor Jones (defense first — "always think about losing money"; cut losers fast; asymmetric small-risk/large-reward bets; weigh the macro), Nassim Taleb (respect fat tails & IV; never blow up; never let one trade or a held-to-zero option threaten the account), Jesse Livermore (read the tape, trade with the trend, sit tight in winners, cut losers without argument, master psychology — the market's message beats your opinion), George Soros (size up only when the edge is genuinely large; be willing to be wrong fast), Warren Buffett (patience; swing only at fat pitches; know exactly what you trade), and modern educators like Sosnoff (mechanics, manage winners, trade probabilities small and repeatedly).

Coach by these on every answer: (1) Probability, not prophecy — give scenarios with odds and the exact confirm/invalidate levels; say what would make you wrong; never a guarantee. (2) Risk & defense first — start with the stop, the size, and the max loss before the target. (3) Trade the trigger, not the prediction. (4) Asymmetry & discipline — favor reward that dwarfs risk; cut losers fast; scale out of winners into strength; never hold a long option to zero. (5) Respect volatility & time — factor IV crush, theta, and events (Fed/CPI/jobs/ISM). (6) Teach while you analyze — explain the why in plain language with concrete examples.

Act as three roles at once: ANALYZER (break down any chart, ticker, or trade against structure, levels, volume, and the greeks), TEACHER (turn every situation into a lesson tied to my rules), PREDICTOR (lay out probable scenarios with confirm/invalidate levels and what smart-money/macro context suggests — always as odds, never certainty).

Hard rules: You are educational, not a financial advisor — never a guaranteed call or a blind buy/sell-now; frame everything as a plan with odds and levels. If I'm about to repeat my leak (chasing a far-OTM lotto, holding to expiration, entering with no trigger), call it out directly. When you don't know a current price, event date, or fact, say so or ask — don't guess. Keep me honest: process over outcome, defense over offense, probability over prediction. Be concise and concrete.`;
const TUTOR_SYS=MENTOR_SYS+`

You live inside my trading journal app. When helpful, point me to the app's tools (Tools tab calculators & key levels, Playbook glossary & lessons, Journal). Keep answers concise — under ~180 words unless I ask for depth. If a question is ambiguous, ask one short clarifying question first.`;
const TUTOR_STARTERS=["What's my biggest leak?","Pressure-test my IWM short plan","Should I hold a put to expiration?","How do I size off my stop?"];
function fileToB64(file){
  return new Promise((res,rej)=>{ const r=new FileReader();
    r.onload=()=>res({media_type:file.type||"image/png", data:String(r.result).split(",")[1], name:file.name});
    r.onerror=rej; r.readAsDataURL(file); });
}
/* downscale an image file to a small JPEG data URL for the knowledge library (keeps storage light) */
function fileToThumb(file, max=760, q=0.6){
  return new Promise((res,rej)=>{ const r=new FileReader();
    r.onload=()=>{ const img=new Image();
      img.onload=()=>{ try{
        const scale=Math.min(1, max/Math.max(img.width,img.height));
        const w=Math.max(1,Math.round(img.width*scale)), h=Math.max(1,Math.round(img.height*scale));
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",q));
      }catch(e){ rej(e); } };
      img.onerror=rej; img.src=r.result; };
    r.onerror=rej; r.readAsDataURL(file); });
}
/* Reusable chat with image upload. Persists TEXT only (images kept for the live session). */
function ChatBox({storageKey, system, starters=[], intro, placeholder="Ask a question…"}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [pending,setPending]=useState([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [ready,setReady]=useState(false);
  const endRef=useRef(null); const fileRef=useRef(null);
  useEffect(()=>{(async()=>{ const m=await sGet(storageKey);
    if(Array.isArray(m)) setMsgs(m.map(x=>({role:x.role, text: x.text!=null?x.text : (typeof x.content==="string"?x.content:"")})));
    setReady(true); })();},[storageKey]);
  useEffect(()=>{ if(ready) sSet(storageKey, msgs.slice(-40).map(m=>({role:m.role,text:m.text}))); },[msgs,ready,storageKey]);
  useEffect(()=>{ if(endRef.current) endRef.current.scrollIntoView({behavior:"smooth",block:"end"}); },[msgs,loading,pending]);

  async function pickFiles(e){
    const files=[...(e.target.files||[])].filter(f=>f.type.startsWith("image/")).slice(0,4);
    try{ const b=await Promise.all(files.map(fileToB64)); setPending(p=>[...p,...b].slice(0,4)); }catch(_){}
    if(fileRef.current) fileRef.current.value="";
  }
  async function send(text){
    const q=((text!=null?text:input)||"").trim();
    if((!q && pending.length===0)||loading) return;
    setInput(""); setErr("");
    const userMsg={role:"user",text:q||"(screenshot)",images:pending};
    const next=[...msgs,userMsg];
    setMsgs(next); setPending([]); setLoading(true);
    try{
      const apiMsgs=next.map(m=>{
        if(m.images&&m.images.length){
          return {role:m.role, content:[...m.images.map(im=>({type:"image",source:{type:"base64",media_type:im.media_type,data:im.data}})), {type:"text",text:m.text||""}]};
        }
        return {role:m.role, content:m.text};
      });
      let sys=system;
      try{ const kb=await sGet("coach:kb"); if(Array.isArray(kb)&&kb.length){ sys=system+"\n\n=== THIS TRADER'S OWN KNOWLEDGE BASE (authoritative about their rules, playbook, style, lessons, and current bias — use it in every answer) ===\n"+kb.map(k=>"• "+k.title+": "+k.content).join("\n"); } }catch(e){}
      const data=await callClaude({ maxTokens:1000, system:sys, messages:apiMsgs });
      const t=getText(data)||"Hmm, I didn't get that — try again.";
      setMsgs(m=>[...m,{role:"assistant",text:t}]);
    }catch(e){ setErr("Chat unavailable — check your connection and try again."); }
    setLoading(false);
  }
  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      <div className="scroll" style={{display:"flex",flexDirection:"column",gap:10,maxHeight:440,overflowY:"auto",paddingRight:4}}>
        {msgs.length===0 &&
          <div style={{padding:"16px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:12}}>
            <div style={{fontSize:14.5,color:"var(--bone)",lineHeight:1.55,marginBottom:starters.length?12:0}}>{intro}</div>
            {starters.length>0 &&
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {starters.map(s=>(<button key={s} onClick={()=>send(s)} className="mono"
                  style={{border:"1px solid var(--line2)",background:"var(--bg2)",color:"var(--focus)",borderRadius:8,padding:"7px 11px",fontSize:13,fontWeight:600,cursor:"pointer"}}>{s}</button>))}
              </div>}
          </div>}
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"86%"}}>
              {m.images&&m.images.length>0 &&
                <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end",marginBottom:6}}>
                  {m.images.map((im,j)=>(<img key={j} src={"data:"+im.media_type+";base64,"+im.data} alt="upload" style={{maxWidth:150,maxHeight:120,borderRadius:8,border:"1px solid var(--line2)"}}/>))}
                </div>}
              <div style={{padding:"10px 13px",borderRadius:12,fontSize:15,lineHeight:1.6,whiteSpace:"pre-wrap",
                background:m.role==="user"?"rgba(227,168,87,0.12)":"var(--bg)",
                border:"1px solid "+(m.role==="user"?"var(--brass-dim)":"var(--line)"),color:"var(--bone)"}}>{m.text}</div>
            </div>
          </div>
        ))}
        {loading &&
          <div style={{display:"flex",justifyContent:"flex-start"}}>
            <div style={{padding:"10px 13px",borderRadius:12,background:"var(--bg)",border:"1px solid var(--line)",color:"var(--dim)",fontSize:14.5,display:"flex",alignItems:"center",gap:8}}><span className="spin"/> thinking…</div>
          </div>}
        <div ref={endRef}/>
      </div>

      {err && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:10}}>{err}</div>}

      {pending.length>0 &&
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
          {pending.map((im,i)=>(
            <div key={i} style={{position:"relative"}}>
              <img src={"data:"+im.media_type+";base64,"+im.data} alt="pending" style={{width:56,height:56,objectFit:"cover",borderRadius:8,border:"1px solid var(--line2)"}}/>
              <button onClick={()=>setPending(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:"var(--bear)",color:"#0E1116",border:"none",fontSize:13.5,fontWeight:800,cursor:"pointer",lineHeight:1}}>×</button>
            </div>
          ))}
        </div>}

      <div style={{display:"flex",gap:8,marginTop:12,alignItems:"flex-end"}}>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={pickFiles} style={{display:"none"}}/>
        <button className="btn" onClick={()=>fileRef.current&&fileRef.current.click()} title="Attach screenshot" style={{padding:"9px 12px"}}>📎</button>
        <textarea rows={1} placeholder={placeholder} value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }}
          style={{resize:"none",minHeight:44}}/>
        <button className="btn-primary btn" onClick={()=>send()} disabled={loading} style={{whiteSpace:"nowrap"}}>Send</button>
      </div>
    </div>
  );
}
function TutorChat(){
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Tutor</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Ask anything — I'll teach you</h3><Help text="Chat with your mentor coach. It answers using everything you've taught it (your rules, leak, bias) plus the greats' principles — probability-first, defense-first. Ask about a setup, pressure-test a trade, or 📎 attach a chart. Educational, never a guaranteed call."/></div>
      <p style={{margin:"0 0 14px",fontSize:14,color:"var(--dim)"}}>The Strat, ICT, options, risk, charting, journaling — ask in plain English or 📎 attach a chart screenshot. Educational only, not financial advice.</p>
      <ChatBox storageKey="tutor:chat" system={TUTOR_SYS} starters={TUTOR_STARTERS}
        intro="Hey — I'm your trading tutor. Ask me to explain any setup, indicator, or Greek, upload a chart for feedback, or ask how to journal a trade. Try one of these:"/>
    </div>
  );
}
function buildTradeSystem(t){
  const opt = t.instrument==="Option" ? ` ${t.optType||""} ${t.strike||""} exp ${t.expiry||""}` : "";
  const det=`Ticker ${t.ticker||"?"} · ${t.instrument||"?"}${opt} · ${t.direction||""} · ${t.horizon||""}/${t.timeframe||""}. Entry ${t.entry||"?"}, exit ${t.exit||"?"}, qty ${t.quantity||"?"}. Setup: ${t.setup||"—"}. Plan followed: ${t.planFollowed?"yes":"no"}. Execution: ${t.emotion||"—"}. P&L: ${fmtMoney(computePnl(t))}. Notes: ${t.notes||"(none)"}.`;
  return `${TUTOR_SYS}\n\nThe user is reviewing THIS specific logged trade:\n${det}\n\nHelp them learn from it: grade the structure against their rules, point out what to repeat or fix, and answer their questions. If they upload a screenshot, read the chart and tie it back to the trade. Be concise and concrete. Educational only — no buy/sell advice.`;
}

const PLAYBOOK_PDF="https://drive.google.com/file/d/1bXT6Imdibj4hYcL5QiJGGXh7744BEgbM/view";
const PIPELINE=[
  ["Bias from structure","Read the higher timeframes first — Daily, then 60m. HH/HL = up, LH/LL = down. Note the trend, but don't pre-commit to a direction."],
  ["Check FTFC","Do Daily, 60m and your entry chart all point the same way? Aligned = trade with size. Conflict = cut size, tighten the target, or stand aside."],
  ["Mark the pivot","The prior bar's high and low are your trigger lines. Write the exact number down before the candle forms."],
  ["Wait for the trigger","Price must actually break the level. No break, no trade. This is where anticipation kills accounts — you react, you don't predict."],
  ["Set the stop, then size","Stop just past the trigger (the level that proves you wrong). Size off that stop so a full stop-out costs a fixed % — not off how confident you feel."],
  ["Target the next pivot — and take it","Your target is the next structural level, not infinity. When price gets there, bank it. Greed past the pivot round-trips winners."],
];
const CONTRACT_DEFAULTS=[["Moneyness","ATM / 1 strike ITM"],["Delta","0.55 – 0.70"],["Day trades","3 – 5 DTE"],["Swings","30 – 60 DTE"],["Liquidity","Tight spread · real OI"]];
const CHART_SETUP=[["Instrument","IWM + AI/semi watchlist"],["Bias & FTFC","Daily & 60m"],["Triggers & entries","30m / 15m / 5m"],["Key levels","prior day H/L · overnight range · 52-wk high · pivots"],["Alerts","set at each trigger the night before"]];
const PREMARKET=[
  "Faith / quiet time first — then read Daily & 60m structure and write the trend.",
  "Mark prior day high/low and the nearest pivots — today's trigger lines.",
  "Build BOTH branches: the 2-up plan and the 2-down plan (level, stop, target, contract).",
  "Set alerts at each trigger the night before; flag earnings/Fed/CPI as IV-crush risk.",
];
const EOD_ROUTINE=[
  "Log every trade: setup, trigger, whether you followed the plan, and the emotion behind it.",
  "Score discipline, not just P&L — did you take real triggers and honor stops?",
  "Note which setups paid and which didn't — feed the edge table.",
  "Mark tomorrow's levels so you open ready.",
];
function Routine({t}){
  return (
    <div style={{display:"flex",gap:9,alignItems:"flex-start",padding:"6px 0"}}>
      <span style={{color:"var(--brass)",fontSize:14.5,marginTop:1}}>▸</span>
      <span style={{fontSize:14,color:"var(--dim)",lineHeight:1.5}}>{t}</span>
    </div>
  );
}
function OptionsPlaybook(){
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>The Strat + Options Playbook</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Your trade framework</h3><Help text="Your whole method in one place: the 6-step pipeline (bias → FTFC → pivot → trigger → stop/size → target), contract defaults, pre-market & end-of-day routines, and the full 12-page PDF. Run every trade through these six steps in order."/></div>
      <p style={{margin:"0 0 16px",fontSize:14,color:"var(--dim)"}}>Trigger-first, top-down. Every trade runs the same gate — if any step fails, you wait. That's the whole discipline in one column.</p>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {PIPELINE.map((s,i)=>(
          <div key={i} style={{display:"flex",gap:13,padding:"12px 14px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11}}>
            <span className="mono" style={{fontSize:15,fontWeight:800,color:"var(--brass)",minWidth:20}}>{i+1}</span>
            <div><span className="disp" style={{fontSize:15.5,fontWeight:700,color:"var(--bone)"}}>{s[0]}</span>
              <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.5,marginTop:2}}>{s[1]}</div></div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,padding:"12px 15px",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:11}}>
        <div className="eyebrow" style={{marginBottom:5}}>The one rule above all</div>
        <div style={{fontSize:14,color:"var(--bone)",lineHeight:1.55}}>Enter on the trigger. Exit on the stop or the target. Holding a loser because it "should" come back isn't a plan — it's theta feeding on you.</div>
      </div>

      <div className="eyebrow" style={{margin:"18px 0 8px"}}>Contract selection defaults</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))",gap:10}}>
        {CONTRACT_DEFAULTS.map(([k,v])=>(
          <div key={k} style={{padding:"11px 13px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
            <div className="eyebrow" style={{marginBottom:5}}>{k}</div>
            <div className="mono" style={{fontSize:15,fontWeight:700,color:"var(--brass)"}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,padding:"12px 15px",background:"rgba(111,168,220,0.06)",border:"1px solid var(--line2)",borderRadius:11}}>
        <div className="eyebrow" style={{marginBottom:5}}>Worked example</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.6}}>IWM 2-up at prior high <b style={{color:"var(--bone)"}}>300.47</b>, target next pivot <b style={{color:"var(--bone)"}}>302.0</b>. A ~0.60-delta call, 3–5 DTE, ATM/one-strike ITM, on a ~1.25-pt move gains ≈ 0.60 × 1.25 ≈ <b style={{color:"var(--bull)"}}>$0.75/share (~$75/contract)</b> before spread and decay. Size so a stop back under 300.47 costs a fixed, pre-decided % of the account.</div>
      </div>

      <div className="eyebrow" style={{margin:"18px 0 8px"}}>Chart setup</div>
      <div style={{padding:"4px 14px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11}}>
        {CHART_SETUP.map(([k,v],i)=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"baseline",padding:"9px 0",borderBottom:i<CHART_SETUP.length-1?"1px solid var(--line)":"none"}}>
            <span className="mono" style={{fontSize:13,color:"var(--brass)",fontWeight:600,whiteSpace:"nowrap"}}>{k}</span>
            <span style={{fontSize:13.5,color:"var(--dim)",textAlign:"right",lineHeight:1.4}}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginTop:18}}>
        <div>
          <div className="eyebrow" style={{marginBottom:6}}>Pre-market routine</div>
          {PREMARKET.map((t,i)=><Routine key={i} t={t}/>)}
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom:6}}>End-of-day routine</div>
          {EOD_ROUTINE.map((t,i)=><Routine key={i} t={t}/>)}
        </div>
      </div>

      <div style={{marginTop:16,padding:"12px 15px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11}}>
        <div className="eyebrow" style={{marginBottom:5}}>The compounding reality</div>
        <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.6}}>~7 in 10 retail day traders lose over a year. The edge isn't a heroic week — it's positive expectancy, small size, and not blowing up, compounded patiently. Protecting the downside is the edge; the upside takes care of itself.</div>
      </div>

      <div style={{marginTop:16,padding:"14px 16px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:11,textAlign:"center"}}>
        <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.5,marginBottom:6}}>Read structure. Wait for the trigger. Size off the stop. Take the pivot. Respect IV crush. Journal the truth.</div>
        <div className="disp" style={{fontSize:15.5,fontWeight:700,color:"var(--brass)"}}>No trigger = no trade · No sauce = no deals</div>
      </div>

      <a href={PLAYBOOK_PDF} target="_blank" rel="noopener" className="mono"
        style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:14,fontSize:13.5,fontWeight:600,color:"var(--focus)",textDecoration:"none",border:"1px solid var(--focus)",borderRadius:9,padding:"9px 13px"}}>
        Open the full 12-page playbook PDF ↗
      </a>
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:8}}>Opens the printable Strat + Options Playbook on Google Drive.</div>
    </div>
  );
}


const EE_CANDLES=[
  {x:80, o:250,c:238,h:232,l:256,col:"#E76A5B"},
  {x:135,o:244,c:232,h:226,l:250,col:"#3FB782"},
  {x:190,o:242,c:228,h:220,l:248,col:"#3FB782"},
  {x:245,o:250,c:226,h:205,l:265,col:"#8792A0"},
  {x:300,o:250,c:150,h:140,l:255,col:"#3FB782"},
  {x:355,o:150,c:96, h:90, l:154,col:"#3FB782"},
  {x:410,o:96, c:74, h:68, l:100,col:"#3FB782"},
];
function EntryExitDiagram(){
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Anatomy</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Pinpoint the entry & exit</h3><Help text="A labeled picture of a long / 2-up trade: enter 1 tick above the prior bar's high, stop 1 tick below it, target the next pivot — with the risk (1R) vs reward (~2R) marked. Short / 2-down is the exact mirror. This is your entry mechanic in one image."/></div>
      <p style={{margin:"0 0 14px",fontSize:14,color:"var(--dim)"}}>A long / 2-up. Enter 1 tick above the prior bar's high, stop 1 tick below it, target the next pivot. Short / 2-down is the mirror.</p>
      <div style={{width:"100%",overflowX:"auto"}}>
        <svg viewBox="0 0 640 320" style={{width:"100%",minWidth:520,display:"block"}} xmlns="http://www.w3.org/2000/svg">
          {/* price level lines */}
          <line x1="45" y1="70" x2="466" y2="70" stroke="#3FB782" strokeWidth="1.5" strokeDasharray="5 4"/>
          <line x1="45" y1="205" x2="466" y2="205" stroke="#E3A857" strokeWidth="1.5" strokeDasharray="5 4"/>
          <line x1="45" y1="272" x2="466" y2="272" stroke="#E76A5B" strokeWidth="1.5" strokeDasharray="5 4"/>

          {/* candles */}
          {EE_CANDLES.map((k,i)=>(
            <g key={i}>
              <line x1={k.x} y1={k.h} x2={k.x} y2={k.l} stroke={k.col} strokeWidth="2"/>
              <rect x={k.x-8} y={Math.min(k.o,k.c)} width="16" height={Math.max(3,Math.abs(k.o-k.c))} fill={k.col} rx="1.5"/>
            </g>
          ))}

          {/* markers */}
          <circle cx="300" cy="205" r="5.5" fill="#E3A857" stroke="#0E1116" strokeWidth="1.5"/>
          <circle cx="300" cy="272" r="5.5" fill="#E76A5B" stroke="#0E1116" strokeWidth="1.5"/>
          <circle cx="410" cy="70" r="5.5" fill="#3FB782" stroke="#0E1116" strokeWidth="1.5"/>

          {/* setup-bar callout */}
          <text x="245" y="292" fill="#8792A0" fontFamily="'JetBrains Mono',monospace" fontSize="10" textAnchor="middle">prior / setup bar</text>
          <text x="300" y="130" fill="#3FB782" fontFamily="'JetBrains Mono',monospace" fontSize="10" fontWeight="700" textAnchor="middle">2-up break</text>

          {/* right labels */}
          <text x="478" y="66" fill="#3FB782" fontFamily="'Archivo',sans-serif" fontSize="13" fontWeight="700">TARGET</text>
          <text x="478" y="82" fill="#8792A0" fontFamily="'JetBrains Mono',monospace" fontSize="10">next pivot · take profit</text>

          <text x="478" y="201" fill="#E3A857" fontFamily="'Archivo',sans-serif" fontSize="13" fontWeight="700">ENTRY</text>
          <text x="478" y="217" fill="#8792A0" fontFamily="'JetBrains Mono',monospace" fontSize="10">prior high + 1 tick</text>

          <text x="478" y="268" fill="#E76A5B" fontFamily="'Archivo',sans-serif" fontSize="13" fontWeight="700">STOP</text>
          <text x="478" y="284" fill="#8792A0" fontFamily="'JetBrains Mono',monospace" fontSize="10">prior low − 1 tick</text>

          {/* R brackets */}
          <line x1="452" y1="70" x2="452" y2="205" stroke="#3FB782" strokeWidth="1.5"/>
          <line x1="449" y1="70" x2="455" y2="70" stroke="#3FB782" strokeWidth="1.5"/>
          <line x1="449" y1="205" x2="455" y2="205" stroke="#3FB782" strokeWidth="1.5"/>
          <line x1="452" y1="205" x2="452" y2="272" stroke="#E76A5B" strokeWidth="1.5"/>
          <line x1="449" y1="272" x2="455" y2="272" stroke="#E76A5B" strokeWidth="1.5"/>
        </svg>
      </div>
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:8,lineHeight:1.5}}>Risk = entry → stop (1R). Reward = entry → target (~2R here). Take the pivot; don't hold past it. Educational, not advice.</div>
    </div>
  );
}

function LessonsCard(){
  const li={display:"flex",gap:9,alignItems:"flex-start",fontSize:14,lineHeight:1.55,padding:"10px 12px",borderRadius:9,border:"1px solid var(--line)"};
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Lessons & desk notes</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>Scale out — the skill that fixes the held-to-zero leak</h3><Help text="Your permanent desk notes: today's lesson, the pattern in your journal (what wins vs. what bleeds), the IWM institutional context, the 0DTE 3:30 auto-close trap, and next week's macro calendar. The stuff to reread before you trade."/></div>

      <div style={{padding:"13px 15px",background:"rgba(63,183,130,0.06)",border:"1px solid var(--bull)",borderRadius:11,marginBottom:16}}>
        <div className="eyebrow" style={{marginBottom:6,color:"var(--bull)"}}>Today's lesson · Jul 31</div>
        <div style={{fontSize:14.5,color:"var(--bone)",lineHeight:1.6}}>You sold your IWM $292 call in three pieces (+$16, +$35, +$21) as it moved your way — banking into strength instead of holding for a home run. That's <b style={{color:"var(--brass)"}}>scaling out</b>, and it's the single skill that fixes your biggest leak.</div>
      </div>

      <div className="eyebrow" style={{marginBottom:8}}>The pattern in your journal</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        <div style={{...li,background:"rgba(63,183,130,0.05)"}}>
          <span style={{color:"var(--bull)",fontWeight:800}}>✓</span>
          <span style={{color:"var(--bone)"}}><b>IWM 1-hour continuation calls, sold into strength</b> → consistently green (7/30 +$27, 7/31 +$20, GLD +$31). This is your edge.</span>
        </div>
        <div style={{...li,background:"rgba(231,106,91,0.05)"}}>
          <span style={{color:"var(--bear)",fontWeight:800}}>✕</span>
          <span style={{color:"var(--bone)"}}><b>Far-OTM / held-to-expiration lottos</b> → the leak. CRWV −$253 and the IWM $292 put −$100 both rode to ZERO — about 60% of all your losses in two trades.</span>
        </div>
      </div>
      <div style={{padding:"12px 15px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:11}}>
        <div style={{fontSize:14,color:"var(--bone)",lineHeight:1.6}}><b style={{color:"var(--brass)"}}>The rule:</b> take profit in pieces as it moves your way, and never let a long option ride to expiration on hope. Selling in scales is the antidote to the held-to-zero trades.</div>
      </div>
      <div style={{marginTop:10,padding:"11px 14px",background:"var(--bg)",border:"1px solid var(--line2)",borderRadius:11}}>
        <div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.6}}><b style={{color:"var(--bear)"}}>0DTE timing trap:</b> a same-day option held past ~3:30 PM ET gets auto-closed by the broker at their price, not yours (that −$10 close on 7/31 was Robinhood's risk-check, on 2 contracts at $0.08 — the bot, not you). Exit on your own terms, earlier.</div>
      </div>

      <div className="eyebrow" style={{margin:"18px 0 8px"}}>IWM — who's behind it (desk notes)</div>
      <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.65}}>
        IWM is the <b style={{color:"var(--bone)"}}>iShares Russell 2000 ETF</b>, run by <b style={{color:"var(--bone)"}}>BlackRock</b> — roughly <b style={{color:"var(--bone)"}}>$79B</b> in assets spread across about <b style={{color:"var(--bone)"}}>2,000</b> small-cap stocks, each holding under ~0.4%. No single name drives it — it's a <b style={{color:"var(--bone)"}}>basket that moves on the macro</b> (rates, growth, risk sentiment), not one company's story. Big institutions use IWM to dial small-cap risk on and off, which is exactly why rates and jobs data whip it around. Trade the index behavior, not a stock headline. <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>(iShares, AUM ~mid-2026; holdings rotate.)</span>
      </div>

      <div className="eyebrow" style={{margin:"18px 0 8px"}}>Macro that moves IWM · week of Aug 3</div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {[["Mon Aug 3","ISM Manufacturing PMI · 10:00 ET — small-caps react hard to a sub-50 print"],["Wed Aug 5","ADP employment + ISM Services PMI"],["Fri Aug 7","July jobs report — the biggest IWM mover of the week"]].map(([d,t],i)=>(
          <div key={i} style={{display:"flex",gap:11,alignItems:"baseline",padding:"8px 0",borderBottom:i<2?"1px solid var(--line)":"none"}}>
            <span className="mono" style={{fontSize:13,color:"var(--brass)",fontWeight:700,whiteSpace:"nowrap",minWidth:74}}>{d}</span>
            <span style={{fontSize:14,color:"var(--dim)",lineHeight:1.5}}>{t}</span>
          </div>
        ))}
      </div>
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:10,lineHeight:1.5}}>Small caps are rate- & growth-sensitive. Don't hold naked longs into these prints; respect IV crush around the jobs number. Confirm times before the open.</div>
    </div>
  );
}

const DAYSWING=[
  ["Hold time","Minutes–hours · out by the close","Days to a few weeks"],
  ["Setup TF","5m / 15m (bias from 60m & Daily)","Daily / Weekly"],
  ["Trigger","Break of prior 5m/15m/30m bar","Break of prior daily bar"],
  ["Stop","Tight — cents to a few ticks","Wider — points"],
  ["Target","Next intraday pivot","Next major swing / channel level"],
  ["Options DTE","0–5 DTE","30–60 DTE (theta won't bleed you)"],
  ["Scale out","Yes — into strength","Yes — at each level"],
  ["Main risk","Theta same-day · 3:30 auto-close · noise","Overnight gaps · capital tied up"],
];
function DaySwingCard(){
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Cheat sheet</div>
      <h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Day vs Swing</h3>
      <p style={{margin:"0 0 14px",fontSize:14,color:"var(--dim)"}}>Same Strat, different clock. Match your timeframe, stop, and DTE to how long you're holding.</p>
      <div style={{border:"1px solid var(--line)",borderRadius:11,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"78px 1fr 1fr",background:"var(--bg2)",borderBottom:"1px solid var(--line)"}}>
          <div/>
          <div className="eyebrow" style={{padding:"9px 10px",color:"var(--focus)"}}>Day trade</div>
          <div className="eyebrow" style={{padding:"9px 10px",color:"var(--brass)"}}>Swing trade</div>
        </div>
        {DAYSWING.map(([k,d,s],i)=>(
          <div key={k} style={{display:"grid",gridTemplateColumns:"78px 1fr 1fr",borderBottom:i<DAYSWING.length-1?"1px solid var(--line)":"none"}}>
            <div className="mono" style={{padding:"9px 8px",fontSize:11,color:"var(--faint)",textTransform:"uppercase",letterSpacing:"0.06em",background:"var(--bg)"}}>{k}</div>
            <div style={{padding:"9px 10px",fontSize:13,color:"var(--bone)",lineHeight:1.4,borderLeft:"1px solid var(--line)"}}>{d}</div>
            <div style={{padding:"9px 10px",fontSize:13,color:"var(--bone)",lineHeight:1.4,borderLeft:"1px solid var(--line)"}}>{s}</div>
          </div>
        ))}
      </div>
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:10,lineHeight:1.5}}>The trap is mixing them: a swing thesis on a 0DTE contract, or a day-trade stop on a swing hold. Tag each journal entry's Horizon so you can see which style actually pays you.</div>
    </div>
  );
}

const LIB_TYPES=[["Video","▶","#E8756A"],["Playlist","≣","#B084E9"],["Article","▤","#6FA8DC"],["Note","✎","#E3A857"],["Chart","📈","#3FB782"],["Watchlist","★","#F2BE6E"],["Tool","🔧","#8FB0FF"]];
/* Links seeded into the library. Bump LIBRARY_SEED_VER when you add entries so
   they merge in for people who already loaded an earlier seed (never duplicated
   — matched by URL — and their own deletions/renames are left untouched). */
const LIBRARY_SEED_VER=3;
const LIBRARY_SEED=[
  {url:"https://youtu.be/QVlQ5jfA4kY", type:"Video", title:"Study video 1"},
  {url:"https://youtu.be/yXELw6fwTa0", type:"Video", title:"Study video 2"},
  {url:"https://youtu.be/kUD6FT0n5Qk", type:"Video", title:"Study video 3"},
  {url:"https://youtu.be/fELzjrW-Ga8", type:"Video", title:"Study video 4"},
  {url:"https://youtube.com/playlist?list=PLtFWwLzLEJBovPO8knmLNUQXYjZdiWc3u", type:"Playlist", title:"Study playlist 1"},
  {url:"https://youtube.com/playlist?list=PLoOwDUfJHOPCvUhRARFX0HjUOgULiyTuy", type:"Playlist", title:"Study playlist 2"},
  {url:"https://www.tradingview.com/x/zpWZ4G0K/", type:"Chart", title:"Chart snapshot 1"},
  {url:"https://www.tradingview.com/x/LzJa5Eqa/", type:"Chart", title:"Chart snapshot 2"},
  {url:"https://www.tradingview.com/watchlists/163482724/", type:"Watchlist", title:"My TradingView watchlist"},
  {url:"https://finviz.com/", type:"Tool", title:"Finviz — screener, heat-map & news", notes:"Free stock screener, sector heat-map, and news aggregator. Filter the whole market by your criteria (float, relative volume, gap %, sector, performance), read the S&P heat-map to see where money is rotating, and skim aggregated headlines. A fast pre-filter to build a watchlist BEFORE you spend AI calls on the deeper scans."},
  {url:"https://stockmarketwatch.com/", type:"Tool", title:"Stock Market Watch — live futures & headlines", notes:"One page with real-time index futures, the economic-events calendar, and a fast-scrolling headline ticker. Good pre-market glance for where futures and the calendar sit before the open. (Your in-app News tab pulls its free feed from Yahoo, not this site.)"},
].map((s,i)=>({ id:"seed-"+i, notes:"", img:null, ts:0, ...s }));
function libColor(t){ const f=LIB_TYPES.find(x=>x[0]===t); return f?f[2]:"#8792A0"; }
function libIcon(t){ const f=LIB_TYPES.find(x=>x[0]===t); return f?f[1]:"•"; }
function KnowledgeLibrary(){
  const [items,setItems]=useState([]);
  const [ready,setReady]=useState(false);
  const [draft,setDraft]=useState({title:"",type:"Video",url:"",notes:""});
  const [img,setImg]=useState(null);
  const [busy,setBusy]=useState(false);
  const [editId,setEditId]=useState(null);
  const fileRef=useRef(null);
  useEffect(()=>{(async()=>{
    let l=await sGet("library:items"); if(!Array.isArray(l)) l=[];
    // Merge any seed links this browser hasn't seen yet (matched by URL so nothing
    // duplicates); the trader's own deletions and renames are never overwritten.
    const ver=(await sGet("library:seedVer"))||0;
    if(ver < LIBRARY_SEED_VER){
      const have=new Set(l.map(i=>String(i.url||"").trim()));
      const add=LIBRARY_SEED.filter(s=>s.url && !have.has(s.url));
      if(add.length) l=[...add, ...l];
      await sSet("library:items", l);
      await sSet("library:seedVer", LIBRARY_SEED_VER);
    }
    setItems(l); setReady(true);
  })();},[]);
  useEffect(()=>{ if(ready) sSet("library:items",items); },[items,ready]);
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}));
  const update=(id,patch)=>setItems(x=>x.map(i=>i.id===id?{...i,...patch}:i));
  async function pick(e){ const f=(e.target.files||[])[0]; if(!f) return; setBusy(true); try{ const t=await fileToThumb(f); setImg(t); }catch(_){}; setBusy(false); if(fileRef.current) fileRef.current.value=""; }
  function add(){
    if(!draft.title.trim() && !draft.url.trim() && !img) return;
    const it={id:Date.now()+"",title:draft.title.trim()||draft.url.trim()||"Saved item",type:draft.type,url:draft.url.trim(),notes:draft.notes.trim(),img,ts:Date.now()};
    setItems(x=>[it,...x]); setDraft({title:"",type:draft.type,url:"",notes:""}); setImg(null);
  }
  function del(id){ setItems(x=>x.filter(i=>i.id!==id)); }
  const fld={fontFamily:"inherit",background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--bone)",borderRadius:8,padding:"9px 11px",fontSize:14.5,width:"100%",outline:"none"};
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Knowledge library</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Build your own study shelf</h3><Help text="Save video/article links, your own notes, and chart screenshots in one place — your personal library next to the learning path. Links + notes + images (it can't host full video files)."/></div>
      <p style={{margin:"0 0 14px",fontSize:14,color:"var(--dim)"}}>Save video & article links, your own notes, and chart screenshots in one place. (Links + notes + images — the app can't host full video files.)</p>

      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:10}}>
        <input style={fld} placeholder="Title" value={draft.title} onChange={e=>set("title",e.target.value)}/>
        <select value={draft.type} onChange={e=>set("type",e.target.value)}
          style={{...fld,width:"auto",appearance:"auto",color:libColor(draft.type),fontWeight:600}}>
          {LIB_TYPES.map(([t])=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <input style={{...fld,marginBottom:10}} placeholder="Paste a link (YouTube, article…)" value={draft.url} onChange={e=>set("url",e.target.value)}/>
      <textarea rows={2} style={{...fld,resize:"vertical",marginBottom:10}} placeholder="Your notes / takeaways" value={draft.notes} onChange={e=>set("notes",e.target.value)}/>

      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{display:"none"}}/>
        <button className="btn" onClick={()=>fileRef.current&&fileRef.current.click()} disabled={busy}>{busy?<span className="spin"/>:"📎 Attach screenshot"}</button>
        {img && <div style={{position:"relative"}}>
          <img src={img} alt="attach" style={{width:52,height:52,objectFit:"cover",borderRadius:8,border:"1px solid var(--line2)"}}/>
          <button onClick={()=>setImg(null)} style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:"var(--bear)",color:"#0E1116",border:"none",fontSize:13.5,fontWeight:800,cursor:"pointer",lineHeight:1}}>×</button>
        </div>}
        <div style={{flex:1}}/>
        <button className="btn-primary btn" onClick={add}>Save to library</button>
      </div>

      <div style={{marginTop:18,display:"flex",flexDirection:"column",gap:10}}>
        {items.length===0
          ? <p style={{margin:0,fontSize:14,color:"var(--dim)"}}>Nothing saved yet. Drop in a video link, an article, a note, or a chart screenshot — build the shelf over time.</p>
          : items.map(it=>(
              <div key={it.id} style={{padding:"12px 13px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11}}>
                <div style={{display:"flex",gap:11,alignItems:"flex-start"}}>
                  {it.img && <img src={it.img} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:8,border:"1px solid var(--line2)",flexShrink:0}}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {editId===it.id
                        ? <select value={it.type} onChange={e=>update(it.id,{type:e.target.value})} style={{...fld,width:"auto",appearance:"auto",fontSize:12.5,padding:"3px 7px",color:libColor(it.type),fontWeight:700}}>{LIB_TYPES.map(([t])=><option key={t} value={t}>{t}</option>)}</select>
                        : <span className="mono" style={{fontSize:11.5,fontWeight:700,color:libColor(it.type),border:"1px solid var(--line2)",borderRadius:5,padding:"2px 7px"}}>{libIcon(it.type)} {it.type}</span>}
                      {editId===it.id
                        ? <input autoFocus value={it.title} onChange={e=>update(it.id,{title:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")setEditId(null);}} placeholder="Title" style={{...fld,flex:"1 1 180px",fontSize:14,padding:"5px 9px"}}/>
                        : <span className="disp" style={{fontSize:15.5,fontWeight:700,color:"var(--bone)"}}>{it.title}</span>}
                    </div>
                    {editId===it.id
                      ? <textarea rows={2} value={it.notes} onChange={e=>update(it.id,{notes:e.target.value})} placeholder="Your notes / takeaways" style={{...fld,resize:"vertical",marginTop:8,fontSize:13.5,padding:"7px 9px"}}/>
                      : (it.notes && <div style={{fontSize:14,color:"var(--dim)",marginTop:6,lineHeight:1.5}}>{it.notes}</div>)}
                    {it.url && <a href={it.url} target="_blank" rel="noopener" className="mono" style={{display:"inline-block",marginTop:8,fontSize:13,fontWeight:600,color:"var(--focus)",textDecoration:"none"}}>{it.type==="Video"||it.type==="Playlist"?"▶ Watch":it.type==="Watchlist"?"★ Open watchlist":"Open"} ↗</a>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <button onClick={()=>setEditId(editId===it.id?null:it.id)} style={{background:"none",border:"none",color:editId===it.id?"var(--brass)":"var(--faint)",fontSize:14,cursor:"pointer",padding:2}} title={editId===it.id?"Done":"Rename"}>{editId===it.id?"✓":"✎"}</button>
                    <button onClick={()=>del(it.id)} style={{background:"none",border:"none",color:"var(--faint)",fontSize:16,cursor:"pointer",padding:2}} title="Delete">×</button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

const VOL_ROWS=[
  ["Expansion","#3FB782","A bar clearly taller than the last ~10–20 → real participation. Confirms a breakout/breakdown. Trade WITH it."],
  ["Contraction","#E3A857","Shrinking bars into a move → weak conviction. The move is suspect; likely to stall or fade. Be cautious / wait."],
  ["Climax","#E76A5B","A huge bar at the END of a long run → exhaustion, not continuation. Often marks a top or bottom. Fade / take profit, don't chase."],
];
function VolumeCard(){
  return (
    <div className="card" style={{padding:20}}>
      <div className="eyebrow" style={{marginBottom:4}}>Cheat sheet</div>
      <h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Reading volume</h3>
      <p style={{margin:"0 0 14px",fontSize:14,color:"var(--dim)"}}>Volume confirms — it doesn't predict. It tells you whether the move behind your trigger has conviction.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {VOL_ROWS.map(([k,c,d])=>(
          <div key={k} style={{display:"flex",gap:12,padding:"12px 14px",background:"var(--bg)",border:"1px solid var(--line)",borderLeft:"3px solid "+c,borderRadius:10}}>
            <div className="disp" style={{fontSize:15,fontWeight:700,color:c,minWidth:92}}>{k}</div>
            <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,padding:"12px 15px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:11}}>
        <div style={{fontSize:14,color:"var(--bone)",lineHeight:1.6}}><b style={{color:"var(--brass)"}}>Your rules:</b> want a breakdown to come on an <b>above-average red bar</b>; want the bounce you short into to come on <b>light</b> volume. Green big-vol bar = buyers serious; red big-vol bar = sellers serious. And trade <b>liquid near-money strikes</b> (high option volume, tight spread) so you can scale in and out.</div>
      </div>
      <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:10}}>Weak-volume triggers are the ones that fail. A big-volume trigger still needs the 2-up/2-down break — volume just tells you it has conviction.</div>
    </div>
  );
}

const FOUND_LAYERS=[
  ["Core — the base","#3FB782","One broad, cheap index fund that owns everything. 60–90% of the foundation. Boring on purpose — this is the part that quietly compounds for years."],
  ["Satellites — the tilt","#E3A857","A growth fund plus a couple individual names you believe in. Smaller slices (10–30% total). More upside, more swing — keep them small."],
];
const FOUND_TICKERS=[
  ["VTI / VOO","Total US market (VTI) or S&P 500 (VOO) — owns the whole thing for ~0.03%/yr.","Core ✅"],
  ["QQQM","Nasdaq-100 — big-tech growth. 0.15%/yr. The buy-and-hold version of QQQ (same holdings, cheaper).","Growth tilt"],
  ["SPMO","S&P 500 Momentum — the ~100 strongest-trending names. 0.13%. Spicier; can whipsaw in a rotation.","Momentum tilt"],
  ["AAPL / GOOGL","Individual stocks you have real conviction in. Buy in fractional dollars if the share price is high.","Conviction satellite"],
];
const FOUND_MIX=[["VTI / VOO","60%","core"],["QQQM","20%","growth"],["AAPL","10%","conviction"],["GOOGL","10%","conviction"]];
const FOUND_STEPS=[
  ["Get the base in place first","Emergency cash (3–6 months of expenses) set aside, high-interest debt gone, and only invest money you won't touch for 5+ years."],
  ["Pick the account TYPE — this matters most","A Roth IRA first if you qualify: it grows 100% tax-free and you can pull your contributions anytime (annual limit ~$7k, income limits apply). Then a regular brokerage for anything beyond. Long-term holds belong in the Roth."],
  ["Open it at Schwab or Vanguard","Both are excellent with $0 commissions. Schwab has the nicer app plus fractional 'Stock Slices.' Open account → verify ID → link your bank → fund it. ~10 minutes."],
  ["Buy — in dollars","Search the ticker → Buy → a Market order is fine for these huge, liquid ETFs (or a Limit at the current price if you want control). Enter a dollar amount → Review → Place. Repeat for each holding."],
  ["Automate it (the real secret)","Set an automatic recurring buy every payday into the core fund. That's dollar-cost averaging — you never have to time the market, and dips simply buy you more shares."],
  ["Then leave it alone","Check it monthly, not hourly. Rebalance about once a year back to your target mix. Don't panic-sell red days — over a 5–20 year horizon they're when your auto-buys work hardest for you."],
];
function FoundationCard(){
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0}}>The long game</div><Help text="Your foundation account — the boring, long-term money that compounds while the trading account takes swings. Broad index core first, small tilts second. Education, not personalized advice: size it to your own situation."/></div>
      <h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Build the boring money</h3>
      <p style={{margin:"0 0 14px",fontSize:14,color:"var(--dim)",lineHeight:1.6}}>Keep this separate from your options account, with the opposite rules: buy broad, buy often, hold for years. This foundation is exactly what makes it OK to take swings in The Edge Room.</p>

      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {FOUND_LAYERS.map(([k,c,d])=>(
          <div key={k} style={{display:"flex",gap:12,padding:"12px 14px",background:"var(--bg)",border:"1px solid var(--line)",borderLeft:"3px solid "+c,borderRadius:10}}>
            <div className="disp" style={{fontSize:14.5,fontWeight:700,color:c,minWidth:118,flexShrink:0}}>{k}</div>
            <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>

      <div className="eyebrow" style={{marginBottom:8}}>The building blocks</div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
        {FOUND_TICKERS.map(([t,d,role])=>(
          <div key={t} style={{display:"flex",gap:10,alignItems:"baseline",flexWrap:"wrap",padding:"10px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
            <span className="mono" style={{fontSize:13.5,fontWeight:800,color:"var(--brass)",minWidth:96}}>{t}</span>
            <span style={{flex:"1 1 170px",fontSize:13.5,color:"var(--dim)",lineHeight:1.5}}>{d}</span>
            <span className="mono" style={{fontSize:11.5,color:"var(--comp)"}}>{role}</span>
          </div>
        ))}
      </div>

      <div style={{padding:"12px 15px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:11,marginBottom:16}}>
        <div style={{fontSize:14,color:"var(--bone)",lineHeight:1.6}}><b style={{color:"var(--brass)"}}>Watch the overlap:</b> a broad core (VTI/VOO), QQQM, SPMO and AAPL/GOOGL all hold Apple &amp; Google near the top. Stack them all and you own Apple four times — that's concentration, not diversification. Keep the core different from the tilts.</div>
      </div>

      <div className="eyebrow" style={{marginBottom:8}}>Example foundation <span style={{color:"var(--faint)",textTransform:"none",letterSpacing:0,fontWeight:400}}>· illustration, size to your own plan</span></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
        {FOUND_MIX.map(([t,p,r])=>(
          <div key={t} style={{flex:"1 1 120px",padding:"11px 13px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10,textAlign:"center"}}>
            <div className="mono" style={{fontSize:13,fontWeight:800,color:"var(--bone)"}}>{t}</div>
            <div className="disp" style={{fontSize:20,fontWeight:800,color:"var(--brass)",lineHeight:1.2}}>{p}</div>
            <div className="mono" style={{fontSize:10.5,color:"var(--faint)"}}>{r}</div>
          </div>
        ))}
      </div>

      <div className="eyebrow" style={{marginBottom:8}}>Step by step</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {FOUND_STEPS.map(([t,d],i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"11px 13px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:10}}>
            <span className="mono" style={{fontSize:13.5,fontWeight:800,color:"var(--brass)",flexShrink:0,minWidth:18}}>{i+1}</span>
            <div><div className="disp" style={{fontSize:14.5,fontWeight:700,color:"var(--bone)",marginBottom:2}}>{t}</div><div style={{fontSize:13.5,color:"var(--dim)",lineHeight:1.55}}>{d}</div></div>
          </div>
        ))}
      </div>

      <div style={{padding:"12px 15px",background:"rgba(63,183,130,0.07)",border:"1px solid var(--bull)",borderRadius:11}}>
        <div style={{fontSize:14,color:"var(--bone)",lineHeight:1.6}}><b style={{color:"var(--bull)"}}>The one rule that protects you:</b> keep this account completely separate from your options money — different account, different rules, no borrowing between them. The foundation is what lets you take swings in The Edge Room without risking your future.</div>
      </div>
      <div className="mono" style={{fontSize:11.5,color:"var(--faint)",marginTop:10,lineHeight:1.5}}>Education, not personalized financial advice. Fees and contribution limits change — confirm the current figures, and match the mix to your own timeline, income and risk tolerance.</div>
    </div>
  );
}

function WalkRow({i,t,w,l}){
  const [open,setOpen]=useState(false);
  return (
    <div style={{border:"1px solid "+(open?"var(--line2)":"var(--line)"),borderRadius:11,overflow:"hidden",background:open?"var(--bg)":"transparent"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",gap:12,alignItems:"center",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
        <span className="mono" style={{fontSize:13.5,fontWeight:800,color:"var(--brass)",flexShrink:0,minWidth:20}}>{i}</span>
        <span className="disp" style={{fontSize:15.5,fontWeight:700,color:"var(--bone)",flex:1,lineHeight:1.3}}>{t}</span>
        <span className="mono" style={{fontSize:15,color:open?"var(--brass)":"var(--dim)",flexShrink:0,display:"inline-block",transform:open?"rotate(90deg)":"none",transition:"transform .15s"}}>›</span>
      </button>
      {open && <div style={{padding:"0 14px 13px 46px"}}>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.6,marginBottom:9}} dangerouslySetInnerHTML={{__html:w}}/>
        <div style={{fontSize:13,color:"var(--comp)",lineHeight:1.6,padding:"9px 11px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:9}}><b style={{color:"var(--brass)"}}>🔗 Works with:</b> <span dangerouslySetInnerHTML={{__html:l}}/></div>
      </div>}
    </div>
  );
}
function StepRow({n,title,detail,color}){
  const [open,setOpen]=useState(false);
  return (
    <div style={{border:"1px solid "+(open?"var(--line2)":"var(--line)"),borderRadius:11,overflow:"hidden",background:open?"var(--bg)":"transparent"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",gap:12,alignItems:"center",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
        <span className="mono" style={{fontSize:15,fontWeight:800,color:color||"var(--brass)",flexShrink:0}}>{n}</span>
        <span className="disp" style={{fontSize:15,fontWeight:700,color:"var(--bone)",flex:1,lineHeight:1.3}}>{title}</span>
        <span className="mono" style={{fontSize:15,color:open?"var(--brass)":"var(--dim)",flexShrink:0,display:"inline-block",transform:open?"rotate(90deg)":"none",transition:"transform .15s"}}>›</span>
      </button>
      {open && <div style={{padding:"0 14px 13px 41px",fontSize:14,color:"var(--dim)",lineHeight:1.55}}>{detail}</div>}
    </div>
  );
}
const FIRST_STEPS=[
  ["1","Learn technical analysis","Before you risk a dollar, learn to READ the market — market structure, supply & demand zones, volume shifts, and the story the chart tells before you click buy. If you can't read a chart, you're not trading, you're guessing — and guessing costs money."],
  ["2","Build a repeatable strategy","A process that runs the same every time you see your setup. It must answer the three questions below BEFORE you enter. A repeatable process strips out emotion — you execute a plan you trust instead of reacting in the moment."],
  ["3","Practice before real money","Paper-trade and backtest first — real prices, real strategy, fake money. Prove the strategy works AND that you're disciplined enough to follow it. If you can't do it with fake money, you won't with real."],
  ["4","Journal everything","Your memory lies; your journal won't. Log every trade: times in/out, why you entered, why you exited, your plan & higher-timeframe read, how you felt, did you follow your plan (y/n), and a screenshot. Review weekly to spot what wins and what bleeds."],
];
const STRAT_Q=[
  ["Where & why you ENTER","Your exact setup + confirmation — the trigger. No trigger, no trade."],
  ["Where you EXIT if WRONG","Your stop, set before entry — max 40–50% on the option. Zero is never the stop."],
  ["Where you take PROFIT if RIGHT","Your target(s) — scale out at the next pivots, aiming 1:3 reward-to-risk or better."],
];
function FirstSteps(){
  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><div><div className="eyebrow" style={{marginBottom:4}}>Foundation</div><h3 className="disp" style={{margin:0,fontSize:19,fontWeight:700}}>First steps — build the foundation</h3></div><Help text="The four steps to become consistently profitable, in order — don't skip any. Step 2 is the heart: a repeatable strategy that answers three questions before every entry (where you enter, where you exit if wrong, where you take profit if right)."/></div>
      <p style={{margin:"10px 0 16px",fontSize:14,color:"var(--dim)",lineHeight:1.55}}>Skipping this is why most beginners fail — you can't build a house without a foundation, and the market will knock it down every time.</p>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {FIRST_STEPS.map(([n,t,d])=><StepRow key={n} n={n} title={t} detail={d}/>)}
      </div>

      <div style={{marginTop:14,padding:"14px 15px",background:"rgba(227,168,87,0.06)",border:"1px solid var(--brass-dim)",borderRadius:12}}>
        <div className="eyebrow" style={{marginBottom:10,color:"var(--brass)"}}>Step 2 · your strategy must answer 3 questions before you enter</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {STRAT_Q.map(([q,a],i)=><StepRow key={q} n={i+1} title={q} detail={a}/>)}
        </div>
        <div className="mono" style={{fontSize:12,color:"var(--faint)",marginTop:11,lineHeight:1.5}}>Can't answer all three? You don't have a trade. This is what the "Examine next trade" tool checks for you.</div>
      </div>
    </div>
  );
}

function Playbook(){
  const [plan,setPlan]=useState("");
  const [fb,setFb]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  async function review(){
    if(!plan.trim()) return;
    setLoading(true); setErr(""); setFb("");
    try{
      const data=await callClaude({ maxTokens:1000,
        system:`You are a disciplined options + Strat trading coach. The trader uses The Strat (bar types 1/2/3, 2-up/2-down triggers, FTFC, prior-bar pivots as trigger & target) and trades IWM plus AI/semiconductor names, mostly options. Review their trade plan and give sharp, specific feedback in <=160 words covering ONLY what's relevant: (1) Is there a real trigger, or is this anticipation/hope? (2) FTFC / timeframe alignment. (3) Is the stop defined and is size set OFF that stop (risk a fixed %)? (4) Is the target a real pivot, and will they actually take profit there? (5) Options risk: theta bleed and IV-crush around events. Be direct. If the plan is solid, say so and name the one thing to watch. End with 'Verdict:' one line: Take / Tighten / Skip.`,
        messages:[{role:"user",content:plan}]});
      const t=getText(data); setFb(t||"No feedback returned.");
    }catch(e){ setErr("Coach unavailable. Check connection and retry."); }
    setLoading(false);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <FirstSteps/>
      <StudyList/>
      <OptionsPlaybook/>
      <EntryExitDiagram/>
      <DaySwingCard/>
      <VolumeCard/>
      <FoundationCard/>
      {/* Coach */}
      <div className="card" style={{padding:20}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0}}>Trade coach</div><Help text="Paste a trade idea and it pressure-tests it against your rules before you click: is there a real trigger, or are you anticipating? Right strike/DTE? Where's the stop and the scale-out? It catches the mistake before it costs you."/></div>
        <h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Pressure-test the plan before you click</h3>
        <p style={{margin:"0 0 12px",fontSize:14.5,color:"var(--dim)"}}>Paste your setup — trigger, timeframes, stop, target, contract. The coach checks it against your Strat + money-management rules.</p>
        <textarea rows={4} placeholder="IWM long. D and 60m green (FTFC up). Waiting on 2-up break of prior 15m candle high at 218.40. Stop under trigger 217.90. Target next 60m pivot 221. Buying weekly 219c…"
          value={plan} onChange={e=>setPlan(e.target.value)}/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
          <button className="btn-primary btn" onClick={review} disabled={loading}>{loading?<span className="spin"/>:"Review plan"}</button>
        </div>
        {err && <div style={{color:"var(--bear)",fontSize:13.5,marginTop:10}}>{err}</div>}
        {fb && <div style={{marginTop:14,padding:15,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11,fontSize:15.5,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{fb}</div>}
      </div>

      {/* Reference */}
      <div>
        <div style={{display:"flex",alignItems:"center",gap:7}}><div className="eyebrow" style={{margin:0}}>Glossary</div><Help text="Plain-language definitions of every term in the app — Strat bars, FTFC, structure, ICT, the Greeks, options pricing/execution, volume, and your risk system. Grouped by topic. Your quick reference when a term trips you up."/></div>
        <h3 className="disp" style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Every term, defined beside it</h3>
        <p style={{margin:"0 0 16px",fontSize:14.5,color:"var(--dim)"}}>
          <span style={{color:"var(--brass)",fontWeight:600}}>Term</span> in gold, its <span style={{color:"var(--comp)",fontWeight:600}}>plain-language definition and detail</span> in blue beside it.
        </p>
        <GlossaryView/>
      </div>
    </div>
  );
}
const GLOSSARY=[
  {cat:"Bar types",sub:"How each candle reads vs. the prior one",items:[
    {term:"Type 1 · Inside",dia:"inside",def:"An <b>inside bar</b>: high lower than the prior high AND low higher than the prior low. Price is contracting inside the last candle — no trigger yet, this is where you wait, not enter."},
    {term:"Type 2 · 2-up",dia:"up2",def:"A directional <b>up</b> bar that breaks the prior bar's high but NOT its low. Trading through that prior high is your <b>long trigger</b>."},
    {term:"Type 2 · 2-down",dia:"down2",def:"A directional <b>down</b> bar that breaks the prior bar's low but NOT its high. Trading through that prior low is your <b>short trigger</b>."},
    {term:"Type 3 · Outside",dia:"outside",def:"An <b>outside / engulfing</b> bar that takes out BOTH the prior high and the prior low. Broad and volatile — it can trap traders on both sides."},
  ]},
  {cat:"Actionable signals",sub:"The bar combinations worth taking",items:[
    {term:"2-1-2",dia:"s212",def:"Directional bar, inside bar, then a directional break out of the inside bar. The inside bar coils the energy; the break is a clean, defined entry. Same direction = continuation, opposite = reversal."},
    {term:"3-1-2",dia:"s312",def:"Outside bar, inside bar, then a directional break. The outside bar sets a wide range, the inside tightens it, and the break gives a high-quality entry with a clear stop."},
    {term:"1-2-2",dia:"s122",def:"Inside bar, one directional bar, then a second directional bar the OTHER way — a <b>reversal</b>. The market probes one side, fails, and flips."},
    {term:"2-2",dia:"s22",def:"Two directional bars in a row. Same direction = <b>continuation</b>; opposite = <b>reversal</b>. Read the higher timeframe to know which one you want."},
    {term:"Failed 2",dia:"failed2",def:"A 2-up or 2-down that breaks the level, can't hold, and closes back inside. The failure itself becomes the signal to trade the other way."},
  ]},
  {cat:"Strat continuity scans",sub:"The screener patterns — D/W/M/Q",items:[
    {term:"FTFC grid (D/W/M/Q)",dia:"ftfc",def:"The four-timeframe color row — Daily, Weekly, Monthly, Quarterly. All the same color = <b>Full Time Frame Continuity</b> (all up or all down), the highest-odds directional environment. Mixed colors = a broadening range; trade the edges, not continuation."},
    {term:"Nirvana (1-3)",dia:"nirvana",def:"An <b>inside bar (Type 1) then an outside bar (Type 3)</b> — price coils tight, then expands violently through both sides. A high-energy breakout setup; trade the side that holds after the outside bar."},
    {term:"Holy Grail (3-1)",dia:"holy",def:"An <b>outside bar (Type 3) then an inside bar (Type 1)</b> — a broad, volatile range followed by a tight coil inside it. The break of that inside bar is a clean, defined entry with a small stop."},
  ]},
  {cat:"FTFC & structure",sub:"Reading the environment before you enter",items:[
    {term:"FTFC",dia:"ftfc",def:"<b>Full Time Frame Continuity</b>: month, week, day, 60m… all the same color — all up or all down. The highest-probability directional environment; trade WITH it."},
    {term:"Alignment",dia:"alignment",def:"Checking that the timeframe you're triggering on agrees with the ones above it. Aligned = go; conflicting = you're probably inside a range."},
    {term:"Broadening",dia:"broadening",def:"When timeframes disagree, price often just expands a range (higher highs and lower lows). Trade the edges — the swing high/low — not continuation."},
  ]},
  {cat:"Market structure",sub:"Reading trend from swing points (price action / ICT)",items:[
    {term:"Swing high / low",dia:"swing",def:"A <b>swing high</b> is a candle whose high tops the candles on both sides; a <b>swing low</b> bottoms its neighbors. These pivots are the skeleton of structure — and where stops (liquidity) rest."},
    {term:"HH / HL",dia:"hhhl",def:"<b>Higher highs and higher lows</b> = bullish structure, an uptrend. The trend is intact as long as price keeps printing them."},
    {term:"LH / LL",dia:"lhll",def:"<b>Lower highs and lower lows</b> = bearish structure, a downtrend — the mirror of the bullish case."},
    {term:"BOS",dia:"bos",def:"<b>Break of Structure</b> — price breaks the most recent swing point IN the trend direction. Confirms continuation."},
    {term:"CHoCH",dia:"choch",def:"<b>Change of Character</b> — the FIRST break against the trend (e.g. taking out a higher low in an uptrend). The earliest reversal warning."},
    {term:"MSS",dia:"mss",def:"<b>Market Structure Shift</b> — a decisive break of structure, usually with displacement, that flips the near-term bias and confirms the CHoCH."},
    {term:"Buyside / sellside",dia:"liquidity",def:"Resting stop orders. <b>Buyside</b> liquidity sits ABOVE swing highs, <b>sellside</b> BELOW swing lows. Price is drawn to these pools to fill orders before it reverses."},
    {term:"Liquidity hunting",dia:"liqgrab",def:"Price is drawn to the obvious stops — just above swing highs (buyside) and below swing lows (sellside). A <b>liquidity hunt</b> is the engineered spike that trips those stops, fills large orders against them, then reverses. If your stop sat at the obvious level, <b>you were the liquidity</b> — taken out right before the move you wanted."},
    {term:"Don't be the liquidity",dia:"sweepreclaim",def:"Two habits keep you from being the exit. <b>(1) Put your stop BEYOND the obvious level, not on it</b> — under the sweep wick, not on the round number every stop clusters at. <b>(2) Treat a sweep-and-reclaim as an entry, not a stop-out</b> — when price spikes past a swing low and closes back above it, the hunt is finished and the reversal is your trade (go long the reclaim, stop under the wick). The raid that stops everyone else out is your signal."},
  ]},
  {cat:"Market-maker models · ICT",sub:"How price is engineered — the ICT (Inner Circle Trader) blueprints",items:[
    {term:"MMBM",dia:"mmbm",def:"<b>Market Maker Buy Model.</b> The bullish blueprint: consolidation → a <b>sell program</b> runs sellside liquidity down to a discount low → smart-money reversal → a <b>buy program</b> marks price up through buyside liquidity. Goal: buy the low, don't chase the top."},
    {term:"MMSM",dia:"mmsm",def:"<b>Market Maker Sell Model</b> — the inverse: consolidation → a buy program lifts price into premium and runs buyside liquidity → reversal at the high → a sell program marks price down. Goal: sell / buy puts at the high."},
    {term:"Consolidation",def:"The sideways base a model starts from. Orders build on both sides before the engineered move begins."},
    {term:"Buy / sell program",def:"The delivered leg. A <b>buy program</b> marks price up, a <b>sell program</b> marks it down — each grabbing the liquidity resting on that side."},
    {term:"Smart-money reversal",def:"The turn at the extreme (a low in MMBM, a high in MMSM) where the campaign flips from grabbing liquidity to delivering the real move."},
    {term:"Liquidity grab",dia:"liqgrab",def:"A quick spike beyond a swing high/low that trips resting stops, then reverses. The fuel for the turn — also called a stop run or raid."},
    {term:"Fair value gap",dia:"fvg",def:"<b>FVG</b> — a 3-candle imbalance where price moved so fast it left a gap. Price often returns to 'fill' it, making it a common entry or target."},
    {term:"Order block",dia:"orderblock",def:"The last opposing candle before a strong move — a <b>bullish OB</b> is the last down candle before a rally. Institutions often re-enter from it."},
    {term:"Premium / discount",dia:"premdisc",def:"Split a range at its 50% (equilibrium). Above = <b>premium</b> (look to sell); below = <b>discount</b> (look to buy). Buy low, sell high, framed by the range."},
    {term:"Displacement",dia:"displacement",def:"A strong, fast, one-sided move that creates FVGs — the fingerprint of institutional intent and the trigger for a structure shift."},
    {term:"OTE",dia:"ote",def:"<b>Optimal Trade Entry</b> — the ~62–79% Fibonacci retracement of a displacement leg, a high-probability zone to enter the pullback."},
  ]},
  {cat:"Triggers & pivots",sub:"Where you get in, and where you aim",items:[
    {term:"Trigger",dia:"up2",def:"The exact price that puts you in: the break of the prior bar's high (long) or low (short). <b>No break, no trade</b> — no matter how good it looks."},
    {term:"Pivot",dia:"swing",def:"A prior swing high or low. Acts as both a magnet (target) and a wall (support/resistance). Your target is the NEXT pivot."},
    {term:"Stop",dia:"sizeoffstop",def:"The level just beyond your trigger candle that proves the setup wrong. It defines your risk — and therefore your position size."},
    {term:"Magnitude",def:"The distance from trigger to the next pivot — the room the trade has to run. Weigh it before entering: small magnitude = small reward, often not worth it."},
  ]},
  {cat:"Pivot indicators & horizon",sub:"Calculated levels, and how long you hold",items:[
    {term:"Pivot points",dia:"pivots",def:"A classic indicator: from the prior period's High, Low and Close it plots a central Pivot (PP) with resistances (R1–R3) and supports (S1–S3). Price reacts at these — use them as intraday targets, stops, and bias (holding above PP = bullish lean). Build them in the Tools tab."},
    {term:"Fibonacci pivots",dia:"pivots",def:"Same PP, but the R/S levels sit at 38.2%, 61.8% and 100% of the prior range instead of standard multiples — for traders who find price respects the fib ratios more cleanly."},
    {term:"Camarilla",dia:"pivots",def:"A tighter pivot variant (R1–R4 / S1–S4) built off the close. R3/S3 are common reversal zones; a break of R4/S4 signals a trend day."},
    {term:"Swing trade",dia:"trend",def:"A multi-day hold — days to a few weeks — off higher-timeframe setups (Daily/Weekly FTFC, HTF order blocks). Wider stops, bigger targets. For options use more DTE (30–60+) so overnight theta doesn't bleed you."},
    {term:"Horizon",def:"How long you hold: a <b>scalp</b> is minutes, a <b>day</b> trade closes by the bell, a <b>swing</b> runs days–weeks, a <b>position</b> runs weeks–months. Match your timeframe, DTE and stop to it. Tagged on every journal entry."},
  ]},
  {cat:"Options Greeks",sub:"What moves your contract besides direction",items:[
    {term:"Delta",dia:"delta",def:"How much the option moves per $1 move in the stock, and roughly the probability it finishes in the money. ~0.50 = at the money."},
    {term:"Gamma",dia:"gamma",def:"How fast delta itself changes. Highest at the money and near expiry — it's why short-dated options whip around so hard."},
    {term:"Theta",dia:"theta",def:"Daily time decay in dollars. It bleeds long options every day and accelerates in the last ~2 weeks. Time is the rent you pay to be long premium."},
    {term:"Vega",dia:"vega",def:"Sensitivity to implied volatility. Long options gain when IV rises and lose when it falls — the mechanism behind a <b>crush</b>."},
  ]},
  {cat:"Options risk & terms",sub:"The premium-side vocabulary",items:[
    {term:"IV",def:"<b>Implied volatility</b> — the market's expected movement priced into the option. High IV = expensive premium, and it inflates ahead of known events."},
    {term:"IV crush",dia:"ivcrush",def:"The sharp drop in IV right after an event (earnings, Fed, CPI). It can wipe out a long option even when you got the direction right."},
    {term:"Expected move",dia:"expectedmove",def:"The move already priced in by the premium for an event. To profit buying options into it, the actual move must BEAT this — otherwise IV crush eats you."},
    {term:"Standard deviation (σ)",dia:"stddev",def:"The statistical range price is likely to stay inside, built from IV and time: <b>±1σ ≈ 68%</b> of the time, <b>±2σ ≈ 95%</b>. 1σ = price × IV × √(days/365) — the same math as the expected move. Build the bands in the Tools tab."},
    {term:"DTE",def:"<b>Days to expiration.</b> Fewer DTE = more gamma and faster theta — more explosive, and more fragile."},
    {term:"ITM / ATM / OTM",dia:"moneyness",def:"In / at / out of the money. ITM carries intrinsic value, OTM is all time value, ATM sits right at the strike."},
    {term:"Extrinsic value",dia:"extrinsic",def:"The part of the price that is NOT intrinsic — time value plus volatility. This is exactly the piece theta and IV crush destroy."},
  ]},
  {cat:"Money management",sub:"The part that keeps you in the game — your reinforcement zone",items:[
    {term:"Size off stop",dia:"sizeoffstop",def:"Set size from your risk, not your conviction. <b>Size = dollars risked ÷ (entry − stop).</b> The stop dictates the size, never the other way around."},
    {term:"Risk per trade",def:"A fixed fraction of the account (e.g. 1%) you'll lose on any single trade. Keeps one bad trade from mattering to the account."},
    {term:"R multiple",dia:"rmultiple",def:"Reward measured in units of risk. Risk $100, make $300 = <b>+3R</b>. Thinking in R makes wins and losses comparable across different sizes."},
    {term:"Take profit at pivot",def:"Exit at the next pivot — your logical target. Holding past it on hope tends to give the gain right back."},
    {term:"Trigger, not hope",def:"Enter only on the trigger, exit only on the stop or target. Emotion-based holds are how accounts bleed out."},
  ]},
  {cat:"Journal metrics",sub:"What the dashboard numbers actually mean",items:[
    {term:"Win rate",def:"Share of closed trades that were profitable. A high win rate with tiny wins and big losses still loses money — always read it next to R."},
    {term:"Profit factor",def:"Gross profit ÷ gross loss. Above 1.0 is net positive; <b>1.5+</b> is healthy."},
    {term:"Discipline",def:"How often you followed your plan (trigger + stop + target), regardless of outcome. It measures process quality, separate from P&L."},
    {term:"P&L by setup",def:"Total dollars each Strat trigger has made or lost you. This is the edge table — it tells you which setups to keep taking and which to cut."},
  ]},
  {cat:"Futures & the open",sub:"The overnight tone that sets your session",items:[
    {term:"Index futures",def:"Nearly-24h contracts on the indexes: <b>RTY</b> = Russell 2000 (your IWM), <b>ES</b> = S&P 500 (SPY), <b>NQ</b> = Nasdaq 100 (QQQ), <b>YM</b> = Dow. Before the cash open they show the overnight tone and where price is likely to GAP."},
    {term:"Why futures move options",def:"A big overnight futures move can gap your option straight through your entry or stop before you can act, it sets the opening direction, and it can inflate IV at the open. Check futures pre-market so a gap doesn't blindside you."},
    {term:"Gap risk",dia:"gap",def:"When price opens far from the prior close because of overnight futures action. Stops don't protect you across a gap — the option can open past your stop. Size for it, and be wary of holding through events."},
    {term:"Risk-on / risk-off",def:"Risk-<b>on</b> = futures up, money into stocks (favors calls); risk-<b>off</b> = futures down, money to safety (favors puts). Small caps (RTY/IWM) swing the hardest on this — they lead when risk is on and bleed when it's off."},
  ]},
  {cat:"Options pricing & execution",sub:"What you see on the chain when you go to fill",items:[
    {term:"Strike",def:"The fixed price in the option's name (e.g. the 291 call). It's WHICH contract you own — not what you pay."},
    {term:"Premium",def:"The price you actually pay per share for the option (×100 per contract). This is the number your P&L moves from, not the strike."},
    {term:"Bid / Ask",def:"<b>Bid</b> = what buyers will pay; <b>ask</b> = what sellers want. You generally buy near the ask and sell near the bid."},
    {term:"Mid",def:"The midpoint of bid and ask — a fair estimate of value and a realistic limit price to try to fill at."},
    {term:"Spread",def:"The gap between bid and ask. Tight = liquid and cheap to trade; a wide spread quietly eats your edge on BOTH entry and exit."},
    {term:"Liquidity",def:"How easily you can trade a strike — high open interest and volume with a tight spread means clean fills and easy scaling. Thin strikes trap you."},
    {term:"Moneyness",dia:"moneyness",def:"Where the strike sits vs. the stock: <b>ITM</b> (already profitable, pricier, higher delta), <b>ATM</b> (at the strike), <b>OTM</b> (needs the move to come, cheaper, lower delta)."},
  ]},
  {cat:"Reading volume",sub:"Volume tells you if a move is real",items:[
    {term:"Expansion",def:"Volume rising into a move — it CONFIRMS the break. A breakout on above-average volume is far more trustworthy."},
    {term:"Contraction",def:"Volume drying up — it WARNS the move is weak or just coiling. A breakout on light volume often fails."},
    {term:"Climax",def:"A huge volume spike at an extreme — often EXHAUSTION, the last push before a reversal, not a reason to chase."},
    {term:"Exhaustion",dia:"exhaustion",def:"The move's <b>last gasp</b>. After a strong run, price makes one final over-extended push — usually an outsized candle with a <b>long wick</b> into a new high/low on a <b>volume spike</b> — then immediately reverses. The trend has run out of fuel, and whoever chased that last push is the trapped side. It's a reversal tell, <b>not a breakout to chase</b>. Exhaustion into a swept high/low that fails, then reclaims, is the highest-odds turn — the trap and the reversal in one."},
  ]},
  {cat:"Your risk system",sub:"The vocabulary of the Examine calculator",items:[
    {term:"Invalidation",def:"The underlying price where the trade is simply WRONG (e.g. it reclaims the level you shorted). Structure sets the stop, not a flat %."},
    {term:"Structural stop",dia:"sizeoffstop",def:"A stop placed at the invalidation level (converted to a premium via delta), instead of an arbitrary percentage. The 40–50% rule is the guardrail on top."},
    {term:"Risk : reward (RR)",dia:"rmultiple",def:"Reward-if-right ÷ risk-if-wrong. Your gate: <b>1:3 or better = go</b>, under 1:2 = skip. At 1:3 you can be wrong more than right and still profit."},
    {term:"Position sizing",def:"Contracts sized from your risk budget, not your conviction. Enter what you'll risk today; the contract count follows."},
    {term:"Scale out",dia:"scaleout",def:"Selling in pieces into strength (T1/T2/T3) instead of all at once. The one trait every green trade in your journal shared — it banks the gain before it gives back."},
  ]},
  {cat:"Moving averages, VWAP & trend tools",sub:"The trend filter — price action confirmation",items:[
    {term:"Moving average (MA)",dia:"ema",def:"The average closing price over the last N bars, drawn as a line that smooths out noise so you can see the trend. Price above a rising MA = uptrend; below a falling MA = downtrend."},
    {term:"EMA",def:"<b>Exponential Moving Average</b> — a moving average that weights recent bars more heavily, so it reacts faster than a plain (simple) MA. Common lengths: <b>9 / 21</b> (fast, scalping), <b>50</b> (intermediate trend), <b>200</b> (the big-picture trend line). Trading with the EMAs stacked in your direction is higher-odds; getting caught <i>between</i> them is chop/no-man's-land."},
    {term:"50 EMA",def:"The 50-period EMA — a widely-watched intermediate trend line. Above it = bullish lean, below it = bearish. Many traders only take longs above the 50 and shorts below it."},
    {term:"200 EMA",def:"The 200-period EMA — the long-term trend divider. Which side of it price is on tells you the dominant regime; it also acts as major support/resistance that a lot of size defends."},
    {term:"3-bar over MA",def:"Three consecutive bars closing on the same side of a moving average — a simple confirmation that a trend has taken hold. The idea from the recap: once you get it, you 'ride the trend out' rather than fading it."},
    {term:"VWAP",dia:"vwap",def:"<b>Volume-Weighted Average Price</b> — the average price weighted by volume, reset each session. It's the day's 'fair value' line that institutions benchmark fills against. Above VWAP = buyers in control (bullish); below = sellers in control (bearish). A reclaim or rejection of VWAP is a common intraday trigger."},
    {term:"ORB",dia:"orb",def:"<b>Opening Range Breakout</b> — mark the high and low of the first X minutes (a <b>15-min</b> or <b>30-min ORB</b> is common), then trade the break of that range as the session's direction. Pairs with EMA/VWAP: an ORB break in the direction of the trend is stronger."},
    {term:"Opening range",dia:"orb",def:"The high-to-low band of the first few minutes of the session. It frames the day's initial balance — breaks above/below it often set the tone, and it acts as intraday support/resistance afterward."},
    {term:"Price action",def:"Reading the raw movement of price — bars, structure, levels — to make decisions, rather than relying on lagging indicators. The Strat is a price-action method; EMAs/VWAP are filters on top."},
    {term:"Market structure",def:"The pattern of swing highs and lows that defines trend: higher-highs & higher-lows = uptrend, lower-highs & lower-lows = downtrend. A <b>lower high</b> after an uptrend (or the break of structure) is an early reversal tell — the core read in the recap."},
    {term:"Trend",dia:"trend",def:"The prevailing direction of price. <b>Uptrend</b> = HH/HL, price above rising EMAs & VWAP. <b>Downtrend</b> = LH/LL, price below falling EMAs & VWAP. 'Trade with the trend' means aligning your trigger with this backdrop."},
    {term:"Support / Resistance",dia:"sr",def:"Price levels where moves tend to stall or reverse — <b>support</b> below (buyers step in), <b>resistance</b> above (sellers step in). Prior-day highs/lows, session opens, round numbers, and the 50/200 EMAs all act as these."},
    {term:"OHLC",def:"<b>Open-High-Low-Close</b> — the four prices each bar records. 'Open-high, close-low' = a bar that opened strong and got sold (bearish); 'open-low, close-high' = opened weak and got bought (bullish). It's the shape of the candle telling you who won the bar."},
    {term:"EMA / VWAP trend filter",def:"The optional confirm in your Examine checklist: for a LONG, price above the 50 EMA <i>and</i> VWAP; for a SHORT, below both. It's experimental — log it on your trades and let your own win-rate data decide if it improves your edge. A filter, not a signal; don't force it."},
  ]},
];
/* ---------- Strat candlestick diagrams for the glossary ---------- */
const DIAS={
  inside:{ bars:[{x:110,hi:88,lo:22,op:32,cl:78,c:"n",tag:"prior"},{x:180,hi:70,lo:40,op:46,cl:64,c:"n",tag:"inside"}],
    refs:[{p:88,c:"#333D49",label:"prior high"},{p:22,c:"#333D49",label:"prior low"}] },
  up2:{ bars:[{x:110,hi:70,lo:30,op:38,cl:62,c:"n",tag:"prior"},{x:180,hi:92,lo:44,op:48,cl:88,c:"up",tag:"2-up"}],
    refs:[{p:70,label:"long trigger"}] },
  down2:{ bars:[{x:110,hi:70,lo:30,op:40,cl:62,c:"n",tag:"prior"},{x:180,hi:56,lo:8,op:52,cl:12,c:"dn",tag:"2-down"}],
    refs:[{p:30,c:"#E76A5B",label:"short trigger"}] },
  outside:{ bars:[{x:110,hi:66,lo:38,op:44,cl:60,c:"n",tag:"prior"},{x:180,hi:90,lo:14,op:22,cl:84,c:"up",tag:"outside"}],
    refs:[{p:66,c:"#333D49",label:"prior high"},{p:38,c:"#333D49",label:"prior low"}] },
  s212:{ bars:[{x:80,hi:60,lo:28,op:32,cl:56,c:"up",tag:"2"},{x:145,hi:54,lo:38,op:42,cl:50,c:"n",tag:"1"},{x:210,hi:82,lo:46,op:50,cl:78,c:"up",tag:"2"}],
    refs:[{p:54,label:"break = entry"}] },
  s312:{ bars:[{x:80,hi:80,lo:20,op:28,cl:72,c:"up",tag:"3"},{x:145,hi:64,lo:40,op:46,cl:58,c:"n",tag:"1"},{x:210,hi:88,lo:54,op:56,cl:84,c:"up",tag:"2"}],
    refs:[{p:64,label:"break = entry"}] },
  s122:{ bars:[{x:80,hi:60,lo:44,op:48,cl:56,c:"n",tag:"1"},{x:145,hi:80,lo:50,op:52,cl:76,c:"up",tag:"2"},{x:210,hi:78,lo:34,op:74,cl:38,c:"dn",tag:"2 rev"}],
    refs:[{p:50,c:"#E76A5B",label:"flips down"}] },
  s22:{ bars:[{x:110,hi:58,lo:26,op:30,cl:54,c:"up",tag:"2"},{x:180,hi:84,lo:52,op:54,cl:80,c:"up",tag:"2"}],
    refs:[] },
  failed2:{ bars:[{x:110,hi:66,lo:34,op:40,cl:60,c:"n",tag:"prior"},{x:180,hi:84,lo:40,op:60,cl:44,c:"dn",tag:"fail"}],
    refs:[{p:66,label:"poke & close back in"}] },
  nirvana:{ bars:[{x:110,hi:58,lo:44,op:47,cl:55,c:"n",tag:"1 inside"},{x:180,hi:86,lo:18,op:52,cl:80,c:"up",tag:"3 outside"}],
    refs:[] },
  holy:{ bars:[{x:110,hi:86,lo:18,op:26,cl:80,c:"up",tag:"3 outside"},{x:180,hi:64,lo:40,op:46,cl:58,c:"n",tag:"1 inside"}],
    refs:[] },
};
/* Schematic diagrams (lines / curves / zones) for the non-candle concepts. */
const LINES={
  // ---- market structure ----
  swing:{ cap:"peak / trough — the skeleton of trend", paths:[{pts:[[6,34],[20,64],[34,40],[50,78],[64,46],[80,84],[94,54]],c:"foc",w:2}],
    dots:[{x:50,p:78,label:"swing high",c:"br",dy:-6},{x:34,p:40,label:"swing low",c:"n",dy:14}] },
  hhhl:{ cap:"higher highs + higher lows = uptrend", paths:[{pts:[[6,20],[20,46],[32,30],[46,62],[58,46],[72,82],[86,66]],c:"up",w:2}],
    tags:[{x:46,p:70,label:"HH",c:"up"},{x:72,p:90,label:"HH",c:"up"},{x:32,p:22,label:"HL",c:"up"},{x:58,p:38,label:"HL",c:"up"}] },
  lhll:{ cap:"lower highs + lower lows = downtrend", paths:[{pts:[[6,82],[18,56],[30,68],[44,34],[56,48],[70,16],[84,30]],c:"dn",w:2}],
    tags:[{x:18,p:64,label:"LH",c:"dn"},{x:44,p:26,label:"LL",c:"dn"},{x:30,p:76,label:"LH",c:"dn"},{x:70,p:8,label:"LL",c:"dn"}] },
  bos:{ cap:"break of structure = continuation", paths:[{pts:[[6,30],[20,55],[32,42],[48,60],[62,48],[88,84]],c:"up",w:2}],
    refs:[{p:60,c:"n",label:"prior high"}], dots:[{x:70,p:64,label:"BOS ▲",c:"up",dy:-6,anchor:"end"}] },
  choch:{ cap:"first break against trend = reversal warning", paths:[{pts:[[6,28],[20,58],[34,44],[50,66],[64,50],[88,32]],c:"foc",w:2}],
    refs:[{p:44,c:"n",label:"last higher low"}], dots:[{x:76,p:40,label:"CHoCH ▼",c:"dn",dy:14}] },
  mss:{ cap:"decisive break + displacement", paths:[{pts:[[6,42],[24,48],[40,44],[54,50],[88,88]],c:"up",w:2.2}],
    refs:[{p:50,c:"n",label:"structure"}], dots:[{x:72,p:68,label:"MSS ▲",c:"up",dy:-4}] },
  liquidity:{ cap:"stops rest above highs & below lows", paths:[{pts:[[6,42],[28,72],[50,44],[72,72],[94,42]],c:"foc",w:1.8}],
    refs:[{p:80,c:"foc",label:"buyside ≡"},{p:34,c:"dn",label:"sellside ≡"}] },
  // ---- ICT models ----
  mmbm:{ cap:"consolidation → run lows → mark up", zones:[{x0:4,x1:26,p0:44,p1:60,c:"n",op:0.14,label:"base"}],
    paths:[{pts:[[4,52],[26,52],[40,24],[54,30],[72,64],[92,84]],c:"foc",w:2}],
    dots:[{x:40,p:24,label:"discount low",c:"up",dy:15},{x:54,p:30,label:"reversal",c:"br",dy:-7,anchor:"end"}] },
  mmsm:{ cap:"consolidation → run highs → mark down", zones:[{x0:4,x1:26,p0:40,p1:56,c:"n",op:0.14,label:"base"}],
    paths:[{pts:[[4,48],[26,48],[40,76],[54,70],[72,36],[92,16]],c:"foc",w:2}],
    dots:[{x:40,p:76,label:"premium high",c:"dn",dy:-7},{x:54,p:70,label:"reversal",c:"br",dy:16,anchor:"end"}] },
  premdisc:{ cap:"split the range at 50%", zones:[{x0:12,x1:88,p0:50,p1:92,c:"dn",op:0.12,label:"premium — sell"},{x0:12,x1:88,p0:8,p1:50,c:"up",op:0.12,label:"discount — buy"}],
    refs:[{p:50,c:"br",label:"equilibrium",solid:true}] },
  ote:{ cap:"enter the deep retracement", paths:[{pts:[[8,82],[34,16],[72,52]],c:"foc",w:2}],
    zones:[{x0:44,x1:80,p0:42,p1:60,c:"up",op:0.18,label:"OTE 62–79%"}] },
  liqgrab:{ cap:"spike past the level, then reverse", paths:[{pts:[[6,50],[30,54],[46,86],[52,80],[70,40],[92,34]],c:"foc",w:1.8}],
    refs:[{p:78,c:"n",label:"prior high (stops)"}], dots:[{x:46,p:86,label:"grab",c:"dn",dy:-5}] },
  sweepreclaim:{ cap:"sweep the lows, reclaim, then run", paths:[{pts:[[6,66],[20,50],[34,44],[46,24],[54,42],[70,60],[92,82]],c:"up",w:2}],
    refs:[{p:44,c:"n",label:"swing low (obvious stops)"},{p:26,c:"up",label:"your stop → under the wick"}],
    dots:[{x:46,p:24,label:"sweep & reclaim",c:"up",dy:9}] },
  exhaustion:{ cap:"climax spike on huge volume, then it turns", paths:[{pts:[[6,30],[20,44],[34,54],[48,64],[62,76],[72,90],[80,78],[92,42]],c:"foc",w:1.9}],
    dots:[{x:72,p:90,label:"exhaustion",c:"dn",dy:-4}] },
  fvg:{ cap:"fast move leaves a 3-candle gap", paths:[{pts:[[8,40],[30,42],[46,40],[62,74],[86,86]],c:"up",w:2.4}],
    zones:[{x0:50,x1:70,p0:44,p1:66,c:"up",op:0.18,label:"FVG"}] },
  orderblock:{ cap:"last down candle before the move", zones:[{x0:20,x1:34,p0:30,p1:48,c:"dn",op:0.22,label:"OB"}],
    paths:[{pts:[[8,42],[27,36],[46,52],[66,72],[88,86]],c:"up",w:2}] },
  displacement:{ cap:"strong one-sided move = intent", paths:[{pts:[[8,40],[28,42],[44,40],[60,72],[88,88]],c:"up",w:2.6}] },
  // ---- FTFC / environment ----
  broadening:{ cap:"timeframes disagree → range expands", paths:[{pts:[[8,50],[92,84],],c:"n",w:1,dash:true},{pts:[[8,50],[92,16]],c:"n",w:1,dash:true},{pts:[[8,50],[28,60],[48,42],[68,70],[88,30]],c:"foc",w:1.8}] },
  alignment:{ cap:"every timeframe agrees", tags:[{x:16,p:50,label:"▲",c:"up"},{x:38,p:50,label:"▲",c:"up"},{x:60,p:50,label:"▲",c:"up"},{x:82,p:50,label:"▲",c:"up"}],
    refs:[{p:74,c:"n",label:"D · W · M · Q all up"}] },
  // ---- Greeks ----
  delta:{ cap:"option value vs the stock price", paths:[{pts:[[8,14],[26,18],[40,30],[50,50],[60,70],[74,82],[92,86]],c:"foc",w:2}], vlines:[{x:50,c:"n",label:"ATM"}] },
  gamma:{ cap:"delta changes fastest at the money", paths:[{pts:[[8,14],[22,20],[33,36],[43,66],[50,82],[57,66],[67,36],[78,20],[92,14]],c:"foc",w:2}], vlines:[{x:50,c:"n",label:"ATM"}] },
  theta:{ cap:"time decay accelerates into expiry", paths:[{pts:[[8,82],[26,76],[44,64],[60,50],[74,32],[85,16],[92,8]],c:"dn",w:2}], tags:[{x:92,p:16,label:"expiry",c:"dn",anchor:"end"}] },
  vega:{ cap:"value rises with implied volatility", paths:[{pts:[[8,18],[92,82]],c:"foc",w:2}], tags:[{x:10,p:10,label:"low IV",c:"n",anchor:"start"},{x:90,p:90,label:"high IV",c:"n",anchor:"end"}] },
  // ---- options risk ----
  ivcrush:{ cap:"IV inflates into the event, then crushes", paths:[{pts:[[8,38],[28,50],[46,66],[58,74],[62,74],[66,40],[80,32],[92,30]],c:"foc",w:2}], vlines:[{x:62,c:"dn",label:"event"}] },
  expectedmove:{ cap:"the move already priced in", zones:[{x0:8,x1:92,p0:38,p1:62,c:"foc",op:0.14,label:"expected move"}], refs:[{p:50,c:"br",label:"price",solid:true}] },
  stddev:{ cap:"±1σ ≈ 68% · ±2σ ≈ 95%", paths:[{pts:[[8,14],[22,20],[33,36],[43,66],[50,82],[57,66],[67,36],[78,20],[92,14]],c:"foc",w:2}], vlines:[{x:33,c:"n",label:"−1σ"},{x:67,c:"n",label:"+1σ"},{x:19,c:"n",label:"−2σ"},{x:81,c:"n",label:"+2σ"}] },
  moneyness:{ cap:"call · stock above strike = ITM", zones:[{x0:50,x1:92,p0:44,p1:58,c:"up",op:0.14,label:"ITM"},{x0:8,x1:50,p0:44,p1:58,c:"n",op:0.10,label:"OTM"}], vlines:[{x:50,c:"br",label:"strike"}] },
  extrinsic:{ cap:"theta & IV crush eat the extrinsic", zones:[{x0:40,x1:60,p0:8,p1:40,c:"n",op:0.5,label:"intrinsic"},{x0:40,x1:60,p0:40,p1:80,c:"br",op:0.32,label:"extrinsic"}] },
  // ---- pivots / MAs / trend tools ----
  pivots:{ cap:"pivot + support / resistance ladder", refs:[{p:88,c:"dn",label:"R3"},{p:75,c:"dn",label:"R2"},{p:62,c:"dn",label:"R1"},{p:50,c:"br",label:"PP",solid:true},{p:38,c:"up",label:"S1"},{p:25,c:"up",label:"S2"},{p:12,c:"up",label:"S3"}] },
  ema:{ cap:"price above a rising average = uptrend", paths:[{pts:[[6,26],[20,44],[32,34],[46,58],[60,48],[74,72],[88,64]],c:"foc",w:1.7},{pts:[[6,22],[26,32],[46,42],[66,54],[88,62]],c:"br",w:2}],
    tags:[{x:88,p:72,label:"price",c:"foc",anchor:"end"},{x:88,p:54,label:"EMA",c:"br",anchor:"end"}] },
  vwap:{ cap:"the day's volume-weighted fair value", paths:[{pts:[[6,50],[18,64],[30,44],[42,60],[54,46],[66,62],[78,48],[90,60]],c:"foc",w:1.7},{pts:[[6,50],[90,54]],c:"br",w:2}], tags:[{x:90,p:46,label:"VWAP",c:"br",anchor:"end"}] },
  orb:{ cap:"break of the first 15–30 min range", zones:[{x0:8,x1:30,p0:38,p1:62,c:"n",op:0.16,label:"OR"}], paths:[{pts:[[8,50],[30,58],[46,66],[64,78],[86,88]],c:"up",w:2}], refs:[{p:62,c:"br",label:"range high"}] },
  sr:{ cap:"price stalls at support & resistance", refs:[{p:72,c:"dn",label:"resistance"},{p:30,c:"up",label:"support"}], paths:[{pts:[[6,34],[22,68],[40,34],[58,70],[76,34],[92,60]],c:"foc",w:1.7}] },
  trend:{ cap:"an up-trend rides a rising channel", paths:[{pts:[[6,26],[92,86]],c:"n",w:1,dash:true},{pts:[[6,8],[92,68]],c:"n",w:1,dash:true},{pts:[[6,16],[24,32],[40,24],[56,46],[72,38],[92,74]],c:"up",w:2}] },
  // ---- money management ----
  sizeoffstop:{ cap:"size = $ risked ÷ (entry − stop)", refs:[{p:64,c:"up",label:"entry",solid:true},{p:44,c:"dn",label:"stop",solid:true}], arrows:[{x1:24,p1:64,x2:24,p2:44,c:"br"}], tags:[{x:30,p:54,label:"risk",c:"br",anchor:"start"}] },
  rmultiple:{ cap:"reward measured in units of risk", zones:[{x0:22,x1:40,p0:36,p1:50,c:"dn",op:0.42,label:""},{x0:58,x1:76,p0:36,p1:86,c:"up",op:0.42,label:""}], tags:[{x:31,p:28,label:"1R risk",c:"dn"},{x:67,p:28,label:"3R reward",c:"up"}] },
  scaleout:{ cap:"bank pieces into strength", paths:[{pts:[[8,30],[30,44],[50,58],[70,72],[90,84]],c:"up",w:2}], dots:[{x:50,p:58,label:"T1",c:"br",dy:-5},{x:70,p:72,label:"T2",c:"br",dy:-5},{x:90,p:84,label:"T3",c:"br",dy:-5,anchor:"end"}] },
  // ---- futures ----
  gap:{ cap:"an overnight gap jumps the open", refs:[{p:46,c:"n",label:"prior close"}], zones:[{x0:42,x1:60,p0:46,p1:64,c:"br",op:0.16,label:"gap"}], paths:[{pts:[[10,40],[30,46]],c:"n",w:2},{pts:[[60,64],[86,84]],c:"up",w:2}] },
};
function PathDia({d}){
  const W=280,H=124,padL=14,padR=14,axT=14,axB=100;
  const X=x=>padL+(x/100)*(W-padL-padR), Y=p=>axB-(p/100)*(axB-axT);
  const UP="#3FB782",DN="#E76A5B",NEUT="#8792A0",BR="#E3A857",FOC="#6FA8DC",L="#333D49";
  const col=c=>({up:UP,dn:DN,n:NEUT,br:BR,foc:FOC}[c]||c||NEUT);
  const box={maxWidth:300,marginTop:10,background:"#0E1116",border:"1px solid "+L,borderRadius:8};
  const poly=a=>a.map(([x,p])=>`${X(x)},${Y(p)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={box} role="img" aria-label="concept diagram">
      {(d.zones||[]).map((z,i)=>(<g key={"z"+i}>
        <rect x={X(z.x0)} y={Y(z.p1)} width={X(z.x1)-X(z.x0)} height={Y(z.p0)-Y(z.p1)} fill={col(z.c)} opacity={z.op==null?0.14:z.op} rx="3"/>
        {z.label && <text x={(X(z.x0)+X(z.x1))/2} y={(Y(z.p0)+Y(z.p1))/2+3} fill={col(z.c)} fontSize="9" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="middle">{z.label}</text>}
      </g>))}
      {(d.vlines||[]).map((v,i)=>(<g key={"v"+i}>
        <line x1={X(v.x)} x2={X(v.x)} y1={Y(0)} y2={Y(94)} stroke={col(v.c||"n")} strokeWidth="1" strokeDasharray="3 3" opacity="0.7"/>
        {v.label && <text x={X(v.x)} y={Y(97)} fill={col(v.c||"n")} fontSize="8" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="middle">{v.label}</text>}
      </g>))}
      {(d.refs||[]).map((r,i)=>(<g key={"r"+i}>
        <line x1={X(0)} x2={X(100)} y1={Y(r.p)} y2={Y(r.p)} stroke={col(r.c||"br")} strokeWidth="1" strokeDasharray={r.solid?"none":"4 3"} opacity="0.85"/>
        {r.label && <text x={X(100)} y={Y(r.p)-3} fill={col(r.c||"br")} fontSize="8.5" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="end">{r.label}</text>}
      </g>))}
      {(d.paths||[]).map((pth,i)=>(<polyline key={"p"+i} points={poly(pth.pts)} fill="none" stroke={col(pth.c||"foc")} strokeWidth={pth.w||2} strokeDasharray={pth.dash?"4 3":"none"} strokeLinejoin="round" strokeLinecap="round"/>))}
      {(d.arrows||[]).map((a,i)=>(<line key={"a"+i} x1={X(a.x1)} y1={Y(a.p1)} x2={X(a.x2)} y2={Y(a.p2)} stroke={col(a.c||"br")} strokeWidth={a.w||1.5} markerEnd=""/>))}
      {(d.dots||[]).map((dt,i)=>(<g key={"d"+i}>
        <circle cx={X(dt.x)} cy={Y(dt.p)} r={dt.r||3} fill={col(dt.c||"br")}/>
        {dt.label && <text x={X(dt.x)+(dt.anchor==="end"?-5:5)} y={Y(dt.p)+(dt.dy==null?-5:dt.dy)} fill={col(dt.c||"br")} fontSize="8.5" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor={dt.anchor||"start"}>{dt.label}</text>}
      </g>))}
      {(d.tags||[]).map((t,i)=>(<text key={"t"+i} x={X(t.x)} y={Y(t.p)} fill={col(t.c||"n")} fontSize={t.big?"15":"9"} fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor={t.anchor||"middle"}>{t.label}</text>))}
      {d.cap && <text x={X(0)} y={10} fill={BR} fontSize="9.5" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="start">{d.cap}</text>}
    </svg>);
}
function StratDia({kind}){
  if(LINES[kind]) return <PathDia d={LINES[kind]}/>;
  const W=280,H=120,yTop=12,yBot=100;
  const Y=p=>yBot-(p/100)*(yBot-yTop);
  const cw=15, UP="#3FB782", DN="#E76A5B", NEUT="#8792A0", BR="#E3A857", L="#333D49";
  const C={up:UP,dn:DN,n:NEUT};
  const box={maxWidth:300,marginTop:10,background:"#0E1116",border:"1px solid "+L,borderRadius:8};
  if(kind==="ftfc"){
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={box} role="img" aria-label="Full time frame continuity grid">
        <text x={W/2} y={22} fill={BR} fontSize="9.5" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="middle">ALL SAME COLOR = FULL CONTINUITY</text>
        {[["D"],["W"],["M"],["Q"]].map(([lab],i)=>{const x=26+i*60; return (
          <g key={i}>
            <rect x={x} y={38} width={46} height={42} rx="7" fill={UP} opacity="0.92"/>
            <text x={x+23} y={65} fill="#0E1116" fontSize="16" fontWeight="800" textAnchor="middle">▲</text>
            <text x={x+23} y={98} fill={NEUT} fontSize="11" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="middle">{lab}</text>
          </g>);})}
      </svg>);
  }
  const D=DIAS[kind]; if(!D) return null;
  const bar=(b,i)=>{ const c=C[b.c]||NEUT, top=Y(Math.max(b.op,b.cl)), bot=Y(Math.min(b.op,b.cl));
    return (
      <g key={i}>
        <line x1={b.x} x2={b.x} y1={Y(b.hi)} y2={Y(b.lo)} stroke={c} strokeWidth="1.6"/>
        <rect x={b.x-cw/2} y={top} width={cw} height={Math.max(2.5,bot-top)} fill={c} rx="2"/>
        {b.tag && <text x={b.x} y={yBot+14} fill={c} fontSize="9" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="middle">{b.tag}</text>}
      </g>);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={box} role="img" aria-label={`Strat ${kind} pattern`}>
      {(() => { const single=(D.refs||[]).length===1; return (D.refs||[]).map((r,i)=>(
        <g key={"r"+i}>
          <line x1={10} x2={W-10} y1={Y(r.p)} y2={Y(r.p)} stroke={r.c||BR} strokeWidth="1" strokeDasharray="4 3" opacity="0.9"/>
          {r.label && (single
            ? <text x={12} y={13} fill={r.c||BR} fontSize="9.5" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="start">{r.label}</text>
            : <text x={W-12} y={Y(r.p)-4} fill={r.c||BR} fontSize="9" fontFamily="'JetBrains Mono',monospace" fontWeight="700" textAnchor="end">{r.label}</text>)}
        </g>)); })()}
      {D.bars.map(bar)}
    </svg>);
}
/* ---------- Options P/L Lab — multi-leg payoff curves (Black-Scholes) ---------- */
function normCdf(x){
  const b1=0.319381530,b2=-0.356563782,b3=1.781477937,b4=-1.821255978,b5=1.330274429,p=0.2316419,c=0.39894228;
  if(x<0) return 1-normCdf(-x);
  const t=1/(1+p*x);
  return 1-c*Math.exp(-x*x/2)*t*(t*(t*(t*(t*b5+b4)+b3)+b2)+b1);
}
function bsPrice(type,S,K,t,iv,r){
  if(!(S>0)||!(K>0)) return 0;
  if(!(t>0)) return type==="put"?Math.max(K-S,0):Math.max(S-K,0);
  const sig=Math.max(iv,0.0001), sq=Math.sqrt(t);
  const d1=(Math.log(S/K)+(r+sig*sig/2)*t)/(sig*sq), d2=d1-sig*sq;
  return type==="put" ? K*Math.exp(-r*t)*normCdf(-d2)-S*normCdf(-d1)
                      : S*normCdf(d1)-K*Math.exp(-r*t)*normCdf(d2);
}
/* Back out each leg's implied vol from the premium you actually paid, so the
   curve is self-consistent (today's line passes through $0 at the current price). */
function impliedVol(type,S,K,t,prem,r){
  if(!(t>0)||!(S>0)||!(K>0)) return null;
  const intr=type==="put"?Math.max(K-S,0):Math.max(S-K,0);
  if(prem<=intr+1e-4) return null;
  let lo=0.001,hi=5;
  for(let i=0;i<64;i++){ const mid=(lo+hi)/2; if(bsPrice(type,S,K,t,mid,r)>prem) hi=mid; else lo=mid; }
  const v=(lo+hi)/2; return (v>0.0005&&v<4.99)?v:null;
}
const PL_R=0.04;
/* Pure payoff model — used by the P/L Lab AND embedded mini-curves in scans/charts. */
function computePayoff(legsRaw, spot, ivPct){
  const S=num(spot), emIv=(num(ivPct)||0)/100;
  const L=legsRaw.map(l=>({dir:l.dir==="sell"?-1:1,type:l.type,K:num(l.strike),qty:Math.max(0,num(l.qty)||0),dte:Math.max(0,num(l.dte)||0),prem:num(l.prem)||0}))
    .filter(l=>l.K>0&&l.qty>0)
    .map(l=>{ const solved=impliedVol(l.type,S,l.K,l.dte/365,l.prem,PL_R); return {...l, iv:(solved&&isFinite(solved))?solved:(emIv||0.3)}; });
  if(!(S>0)||!L.length) return null;
  const horizon=Math.min(...L.map(l=>l.dte));
  const maxDte=Math.max(...L.map(l=>l.dte));
  const bandIv=emIv || (L.reduce((a,l)=>a+l.iv,0)/L.length);
  const emH=S*bandIv*Math.sqrt(Math.max(horizon,0.5)/365);
  const emMax=S*bandIv*Math.sqrt(Math.max(maxDte,1)/365);
  const strikes=L.map(l=>l.K);
  let lo=Math.min(S,...strikes)-1.7*emMax, hi=Math.max(S,...strikes)+1.7*emMax;
  if(hi-lo<S*0.08){ lo=S*0.9; hi=S*1.1; }
  lo=Math.max(lo,0.01);
  const entry=L.reduce((a,l)=>a+l.dir*l.qty*l.prem,0);
  const val=(price,asOf)=>L.reduce((a,l)=>{ const t=Math.max(0,(l.dte-asOf))/365; return a+l.dir*l.qty*bsPrice(l.type,price,l.K,t,l.iv,PL_R); },0);
  const N=120, now=[], hz=[];
  for(let i=0;i<=N;i++){ const price=lo+(hi-lo)*i/N; now.push([price,(val(price,0)-entry)*100]); hz.push([price,(val(price,horizon)-entry)*100]); }
  const bes=[]; for(let i=1;i<hz.length;i++){ const [p0,v0]=hz[i-1],[p1,v1]=hz[i]; if((v0<=0&&v1>0)||(v0>=0&&v1<0)){ const f=v0/(v0-v1); bes.push(p0+(p1-p0)*f); } }
  let maxP=-1e9,minP=1e9; hz.forEach(([,v])=>{ if(v>maxP)maxP=v; if(v<minP)minP=v; });
  const edgeRising=hz[hz.length-1][1]>hz[hz.length-2][1]+0.5;
  const uncappedUp=(L.some(l=>l.dir>0&&l.type==="call")&&edgeRising);
  const netStr=entry>0?`$${Math.abs(entry*100).toFixed(0)} debit`:entry<0?`$${Math.abs(entry*100).toFixed(0)} credit`:"$0";
  return {S,bandIv,L,horizon,maxDte,emH,emMax,lo,hi,now,hz,bes,maxP,minP,entry,netStr,uncappedUp,plNowAtS:(val(S,0)-entry)*100};
}
/* Build a one-leg position from a scan's suggested contract, then its payoff. */
function contractPayoff({spot,dir,strike,prem,dte,ivPct}){
  const type=(dir==="down"||dir==="Put"||dir==="put")?"put":"call";
  return computePayoff([{dir:"buy",type,strike,qty:1,dte:dte||14,prem}], spot, ivPct);
}
const PL_PRESETS={
  call:{name:"Long call",legs:[{dir:"buy",type:"call",strike:700,qty:1,dte:30,prem:12}]},
  vertical:{name:"Call debit spread",legs:[{dir:"buy",type:"call",strike:690,qty:1,dte:30,prem:16},{dir:"sell",type:"call",strike:710,qty:1,dte:30,prem:7}]},
  straddle:{name:"Long straddle",legs:[{dir:"buy",type:"call",strike:690,qty:1,dte:30,prem:15},{dir:"buy",type:"put",strike:690,qty:1,dte:30,prem:14}]},
  calendar:{name:"Calendar spread",legs:[{dir:"buy",type:"call",strike:700,qty:1,dte:38,prem:5.13},{dir:"sell",type:"call",strike:700,qty:1,dte:10,prem:0.80}]},
  condor:{name:"Iron condor",legs:[{dir:"sell",type:"put",strike:660,qty:1,dte:30,prem:6},{dir:"buy",type:"put",strike:640,qty:1,dte:30,prem:3},{dir:"sell",type:"call",strike:720,qty:1,dte:30,prem:6},{dir:"buy",type:"call",strike:740,qty:1,dte:30,prem:3}]},
};
function PayoffLab({watch}){
  const [sym,setSym]=useState("");
  const [spot,setSpot]=useState("690");
  const [iv,setIv]=useState("28");
  const [legs,setLegs]=useState(PL_PRESETS.calendar.legs.map((l,i)=>({...l,id:i})));
  const [fetching,setFetching]=useState(false);
  const [note,setNote]=useState("");
  useEffect(()=>{(async()=>{ const s=await sGet("pl:state"); if(s&&s.legs){ setLegs(s.legs); if(s.spot)setSpot(s.spot); if(s.iv)setIv(s.iv); if(s.sym)setSym(s.sym);} })();},[]);
  useEffect(()=>{ sSet("pl:state",{legs,spot,iv,sym}); },[legs,spot,iv,sym]);

  const preset=k=>{ const p=PL_PRESETS[k]; setLegs(p.legs.map((l,i)=>({...l,id:Date.now()+i}))); };
  const setLeg=(id,k,v)=>setLegs(ls=>ls.map(l=>l.id===id?{...l,[k]:v}:l));
  const addLeg=()=>setLegs(ls=>[...ls,{id:Date.now(),dir:"buy",type:"call",strike:Math.round(num(spot)||700),qty:1,dte:30,prem:5}]);
  const delLeg=id=>setLegs(ls=>ls.filter(l=>l.id!==id));
  async function fetchPrice(override){
    const s=String(override!=null?override:sym).trim().toUpperCase(); if(!s) return; setFetching(true); setNote("");
    try{ const r=await fetch(`/api/quotes?symbols=${encodeURIComponent(s)}`); const j=await r.json();
      const q=j&&j.quotes&&j.quotes[s]; if(q&&q.price){ setSpot(String(Math.round(q.price*100)/100)); setNote(`${s} @ $${q.price.toFixed(2)} (last)`);} else setNote("No price — enter it manually."); }
    catch(e){ setNote("Couldn't fetch — enter it manually."); }
    setFetching(false);
  }

  const model=useMemo(()=>computePayoff(legs,spot,iv),[legs,spot,iv]);

  const fld={fontFamily:"inherit",background:"var(--bg)",border:"1px solid var(--line2)",color:"var(--bone)",borderRadius:7,padding:"7px 9px",fontSize:13.5,outline:"none"};
  return (
    <div>
      <div className="card" style={{padding:20,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
          <div className="eyebrow" style={{margin:0}}>P/L Lab</div>
          <Help text="Draws the profit/loss curve of any options position across the stock price — the smooth line before expiry (Black-Scholes) and the payoff as of the nearest expiry, with the expected-move band, breakevens, and max profit/loss. Great for seeing calendars, spreads, straddles and condors before you put them on. Premiums & IV are your inputs — confirm on the live chain."/>
        </div>
        <div className="disp" style={{fontSize:25,fontWeight:800,marginBottom:8}}>See the trade before you take it</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.6,marginBottom:14}}>Build a position leg by leg and watch its P/L curve — where it makes money, where it breaks even, and the most it can win or lose. The bright curve is the payoff as of your nearest expiry; the faint one is today.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {Object.entries(PL_PRESETS).map(([k,p])=><button key={k} className="btn" onClick={()=>preset(k)} style={{padding:"6px 11px",fontSize:12.5}}>{p.name}</button>)}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div><div className="eyebrow" style={{fontSize:10,marginBottom:3}}>Ticker (optional)</div><div style={{display:"flex",gap:6}}>
            <select value={sym} onChange={e=>{ const v=e.target.value; setSym(v); if(v) fetchPrice(v); }} style={{...fld,width:130,appearance:"auto",color:sym?"var(--bone)":"var(--faint)"}}>
              <option value="">— pick ticker —</option>
              {(watch||[]).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn" onClick={()=>fetchPrice()} disabled={fetching||!sym} style={{padding:"7px 10px",fontSize:12.5}}>{fetching?<span className="spin"/>:"↻ Price"}</button>
          </div></div>
          <div><div className="eyebrow" style={{fontSize:10,marginBottom:3}}>Stock price</div><input value={spot} onChange={e=>setSpot(e.target.value)} style={{...fld,width:90}}/></div>
          <div><div className="eyebrow" style={{fontSize:10,marginBottom:3}}>IV %</div><input value={iv} onChange={e=>setIv(e.target.value)} style={{...fld,width:70}}/></div>
          {note && <div className="mono" style={{fontSize:12,color:"var(--faint)",paddingBottom:8}}>{note}</div>}
        </div>
      </div>

      {model && <PayoffChart m={model}/>}

      <div className="card" style={{padding:16,marginTop:16}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:10}}><div className="eyebrow" style={{margin:0}}>Legs</div><button className="btn" onClick={addLeg} style={{marginLeft:"auto",padding:"5px 11px",fontSize:12.5}}>+ Add leg</button></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {legs.map(l=>(
            <div key={l.id} style={{display:"grid",gridTemplateColumns:"84px 74px 1fr 60px 68px 78px 28px",gap:7,alignItems:"center"}}>
              <select value={l.dir} onChange={e=>setLeg(l.id,"dir",e.target.value)} style={{...fld,appearance:"auto",color:l.dir==="buy"?"var(--bull)":"var(--bear)",fontWeight:700}}><option value="buy">Buy</option><option value="sell">Sell</option></select>
              <select value={l.type} onChange={e=>setLeg(l.id,"type",e.target.value)} style={{...fld,appearance:"auto"}}><option value="call">Call</option><option value="put">Put</option></select>
              <div style={{display:"flex",gap:5,alignItems:"center"}}><span className="mono" style={{fontSize:11,color:"var(--faint)"}}>K</span><input value={l.strike} onChange={e=>setLeg(l.id,"strike",e.target.value)} style={{...fld,width:"100%"}}/></div>
              <div style={{display:"flex",gap:4,alignItems:"center"}}><span className="mono" style={{fontSize:11,color:"var(--faint)"}}>×</span><input value={l.qty} onChange={e=>setLeg(l.id,"qty",e.target.value)} style={{...fld,width:"100%"}}/></div>
              <div style={{display:"flex",gap:4,alignItems:"center"}}><input value={l.dte} onChange={e=>setLeg(l.id,"dte",e.target.value)} style={{...fld,width:"100%"}}/><span className="mono" style={{fontSize:11,color:"var(--faint)"}}>d</span></div>
              <div style={{display:"flex",gap:4,alignItems:"center"}}><span className="mono" style={{fontSize:11,color:"var(--faint)"}}>$</span><input value={l.prem} onChange={e=>setLeg(l.id,"prem",e.target.value)} style={{...fld,width:"100%"}}/></div>
              <button onClick={()=>delLeg(l.id)} title="Remove" style={{background:"none",border:"1px solid var(--line2)",color:"var(--faint)",borderRadius:6,height:30,cursor:"pointer"}}>×</button>
            </div>))}
        </div>
        <div className="mono" style={{fontSize:11,color:"var(--faint)",marginTop:9}}>Buy/Sell · Call/Put · strike K · contracts × · days-to-expiry d · premium per share $. Premiums & IV are estimates — confirm on the live chain.</div>
      </div>
    </div>
  );
}
function PayoffChart({m,compact}){
  const uid=React.useId().replace(/[^a-zA-Z0-9]/g,"");
  const clipA="pa"+uid, clipB="pb"+uid;
  const W=720,H=compact?190:340,padL=20,padR=20,padT=compact?12:18,padB=compact?30:42;
  const X=p=>padL+((p-m.lo)/(m.hi-m.lo))*(W-padL-padR);
  const yMin=Math.min(m.minP,0), yMax=Math.max(m.maxP,0), yr=(yMax-yMin)||1;
  const Y=v=>padT+(1-(v-yMin)/yr)*(H-padT-padB);
  const zeroY=Y(0);
  const line=a=>a.map(([p,v])=>`${X(p)},${Y(v)}`).join(" ");
  const area=a=>`${a.map(([p,v])=>`${X(p)},${Y(v)}`).join(" ")} ${X(a[a.length-1][0])},${zeroY} ${X(a[0][0])},${zeroY}`;
  const UP="#3FB782",DN="#E76A5B",BR="#E3A857",FOC="#6FA8DC",L="#333D49",DIM="#8792A0";
  const strikes=[...new Set(m.L.map(l=>l.K))];
  const fmt=v=>(v>=0?"+":"−")+"$"+Math.abs(Math.round(v));
  return (
    <div className="card" style={{padding:compact?"10px 10px 6px":"14px 12px 8px"}}>
      <div style={{display:"flex",gap:compact?12:14,flexWrap:"wrap",marginBottom:8,padding:"0 6px"}}>
        {[["Net",m.netStr,m.entry>0?"var(--bear)":"var(--bull)"],
          ["Max profit",m.uncappedUp?"uncapped ↑":fmt(m.maxP),m.maxP>=0?"var(--bull)":"var(--bear)"],
          ["Max loss",fmt(m.minP),"var(--bear)"],
          ["Breakevens",m.bes.length?m.bes.map(b=>"$"+b.toFixed(0)).join(" · "):"—","var(--bone)"],
          ["Exp. move",`±$${m.emH.toFixed(0)} (${m.horizon}d)`,"var(--focus)"]
        ].map(([l,v,c],i)=>(
          <div key={i}><div className="eyebrow" style={{fontSize:9.5,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:compact?13:14.5,fontWeight:800,color:c}}>{v}</div></div>))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{background:"#0E1116",border:"1px solid "+L,borderRadius:8}}>
        <defs>
          <clipPath id={clipA}><rect x="0" y="0" width={W} height={zeroY}/></clipPath>
          <clipPath id={clipB}><rect x="0" y={zeroY} width={W} height={H-zeroY}/></clipPath>
        </defs>
        {/* expected move band (±1σ) */}
        <rect x={X(Math.max(m.S-m.emH,m.lo))} y={padT} width={Math.max(0,X(Math.min(m.S+m.emH,m.hi))-X(Math.max(m.S-m.emH,m.lo)))} height={H-padT-padB} fill={FOC} opacity="0.07"/>
        <line x1={X(Math.max(m.S-m.emH,m.lo))} x2={X(Math.max(m.S-m.emH,m.lo))} y1={padT} y2={H-padB} stroke={FOC} strokeWidth="1" strokeDasharray="3 3" opacity="0.4"/>
        <line x1={X(Math.min(m.S+m.emH,m.hi))} x2={X(Math.min(m.S+m.emH,m.hi))} y1={padT} y2={H-padB} stroke={FOC} strokeWidth="1" strokeDasharray="3 3" opacity="0.4"/>
        {/* P/L fills (green profit / red loss) on the horizon curve */}
        <polygon points={area(m.hz)} fill={UP} opacity="0.16" clipPath={`url(#${clipA})`}/>
        <polygon points={area(m.hz)} fill={DN} opacity="0.16" clipPath={`url(#${clipB})`}/>
        {/* zero line */}
        <line x1={padL} x2={W-padR} y1={zeroY} y2={zeroY} stroke={DIM} strokeWidth="1" opacity="0.6"/>
        {/* strike ticks */}
        {strikes.map((k,i)=>(<g key={i}><line x1={X(k)} x2={X(k)} y1={padT} y2={H-padB} stroke={BR} strokeWidth="1" strokeDasharray="2 4" opacity="0.35"/><text x={X(k)} y={H-padB+13} fill={BR} fontSize="9.5" fontFamily="'JetBrains Mono',monospace" textAnchor="middle">{k}</text></g>))}
        {/* now curve (faint) + horizon curve (bright) */}
        <polyline points={line(m.now)} fill="none" stroke={DIM} strokeWidth="1.6" strokeDasharray="5 4" opacity="0.8"/>
        <polyline points={line(m.hz)} fill="none" stroke={BR} strokeWidth="2.4" strokeLinejoin="round"/>
        {/* breakevens */}
        {m.bes.map((b,i)=>(<g key={i}><circle cx={X(b)} cy={zeroY} r="3.4" fill="#0E1116" stroke={BR} strokeWidth="1.6"/><text x={X(b)} y={zeroY-7} fill={BR} fontSize="9" fontFamily="'JetBrains Mono',monospace" textAnchor="middle">{b.toFixed(0)}</text></g>))}
        {/* current price flag */}
        <line x1={X(m.S)} x2={X(m.S)} y1={padT} y2={H-padB} stroke="#E9E6DF" strokeWidth="1.2" opacity="0.85"/>
        <polygon points={`${X(m.S)},${padT} ${X(m.S)+11},${padT+4} ${X(m.S)},${padT+9}`} fill="#E9E6DF"/>
        <text x={X(m.S)+13} y={padT+8} fill="#E9E6DF" fontSize="9.5" fontFamily="'JetBrains Mono',monospace" fontWeight="700">${m.S.toFixed(0)}</text>
        {/* y labels */}
        <text x={padL+2} y={padT+9} fill={UP} fontSize="9.5" fontFamily="'JetBrains Mono',monospace">{fmt(yMax)}</text>
        <text x={padL+2} y={H-padB-3} fill={DN} fontSize="9.5" fontFamily="'JetBrains Mono',monospace">{fmt(yMin)}</text>
        {/* legend */}
        <g transform={`translate(${W-padR-190},${padT+2})`}>
          <line x1="0" x2="18" y1="0" y2="0" stroke={BR} strokeWidth="2.4"/><text x="22" y="3" fill={DIM} fontSize="9" fontFamily="'JetBrains Mono',monospace">at {m.horizon}d expiry</text>
          <line x1="98" x2="116" y1="0" y2="0" stroke={DIM} strokeWidth="1.6" strokeDasharray="5 4"/><text x="120" y="3" fill={DIM} fontSize="9" fontFamily="'JetBrains Mono',monospace">today</text>
        </g>
      </svg>
      {!compact && <div className="mono" style={{fontSize:11,color:"var(--faint)",padding:"6px 8px 2px",lineHeight:1.5}}>Blue band = 1σ expected move by the {m.horizon}-day expiry. Green = profit, red = loss as of that expiry. Priced with Black-Scholes, each leg's vol backed out of the premium you entered — a guide, not a guarantee; verify on the live chain.</div>}
    </div>
  );
}
/* Embeddable payoff curve for a scan's / chart's suggested contract. */
function MiniPayoff({spot,dir,strike,prem,dte,ivPct}){
  const m=useMemo(()=>contractPayoff({spot,dir,strike,prem,dte,ivPct}),[spot,dir,strike,prem,dte,ivPct]);
  if(!m) return <div className="mono" style={{fontSize:12,color:"var(--faint)",padding:"8px 2px"}}>Add a strike, premium and DTE to see the P/L curve.</div>;
  return <PayoffChart m={m} compact/>;
}
/* ---------- Test / quiz engine — built from the glossary, graded, tracked ---------- */
const stripHtml=s=>String(s||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const TEST_TIER={ "Bar types":1,"Triggers & pivots":1,"Your risk system":1,"Money management":1,"Journal metrics":1,
  "Actionable signals":2,"Strat continuity scans":2,"FTFC & structure":2,"Market structure":2,"Reading volume":2,"Options pricing & execution":2,
  "Market-maker models · ICT":3,"Options Greeks":3,"Options risk & terms":3,"Pivot indicators & horizon":3,"Futures & the open":3,"Moving averages, VWAP & trend tools":3 };
const TEST_LEVELS=[
  {id:1,name:"Basics",blurb:"Start here — bar types, triggers, stops, your risk system. The first things you need to know."},
  {id:2,name:"Signals & structure",blurb:"Setups, FTFC, market structure, volume — reading the environment."},
  {id:3,name:"ICT, Greeks & options",blurb:"The advanced layer — market-maker models, the Greeks, and premium risk."},
  {id:0,name:"Everything",blurb:"A full mix across every topic in the glossary."},
];
function testBank(level){
  const all=[];
  GLOSSARY.forEach(g=>g.items.forEach(it=>all.push({term:it.term,def:stripHtml(it.def),cat:g.cat,dia:it.dia,tier:TEST_TIER[g.cat]||2})));
  return level?all.filter(x=>x.tier===level):all;
}
function tShuffle(a){ const r=a.slice(); for(let i=r.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=r[i]; r[i]=r[j]; r[j]=t; } return r; }
function makeQuestions(level,n){
  const pool=testBank(level), allT=testBank(0);
  return tShuffle(pool).slice(0,n).map(t=>{
    let d=tShuffle(allT.filter(x=>x.cat===t.cat&&x.term!==t.term)).slice(0,3).map(x=>x.term);
    if(d.length<3) d=d.concat(tShuffle(allT.filter(x=>x.term!==t.term&&!d.includes(x.term))).slice(0,3-d.length).map(x=>x.term));
    return {prompt:t.def, answer:t.term, options:tShuffle([t.term,...d.slice(0,3)]), cat:t.cat, dia:t.dia};
  });
}
function testGrade(p){ return p>=90?["A","var(--bull)"]:p>=80?["B","var(--bull)"]:p>=70?["C","var(--brass)"]:p>=60?["D","var(--brass)"]:["F","var(--bear)"]; }
function TestZone(){
  const [view,setView]=useState("home");            // home | quiz | result | progress
  const [level,setLevel]=useState(null);
  const [qs,setQs]=useState([]);
  const [i,setI]=useState(0);
  const [picked,setPicked]=useState(null);
  const [answers,setAnswers]=useState([]);           // aligned to qs: {correct,term,cat,dia,picked,prompt}
  const [hist,setHist]=useState([]);
  const [saved,setSaved]=useState(false);
  useEffect(()=>{ (async()=>{ const h=await sGet("test:history"); if(Array.isArray(h)) setHist(h); })(); },[]);

  function start(lv){ setLevel(lv); setQs(makeQuestions(lv.id,10)); setI(0); setPicked(null); setAnswers([]); setSaved(false); setView("quiz"); }
  function choose(opt){ if(picked!=null) return; const q=qs[i]; setPicked(opt); setAnswers(a=>{ const c=a.slice(); c[i]={correct:opt===q.answer,term:q.answer,cat:q.cat,dia:q.dia,picked:opt,prompt:q.prompt}; return c; }); }
  function next(){ if(i+1<qs.length){ setI(i+1); setPicked(null); } else setView("result"); }
  useEffect(()=>{ (async()=>{
    if(view!=="result"||saved) return;
    setSaved(true);
    const score=answers.filter(a=>a&&a.correct).length, total=qs.length;
    const weak=(await sGet("test:weak"))||{}, mastered=(await sGet("test:mastered"))||{};
    answers.forEach(a=>{ if(!a) return; if(a.correct) mastered[a.term]=(mastered[a.term]||0)+1; else weak[a.term]=(weak[a.term]||0)+1; });
    await sSet("test:weak",weak); await sSet("test:mastered",mastered);
    const attempt={ts:Date.now(),level:level?level.name:"—",score,total,pct:Math.round(score/total*100),missed:answers.filter(a=>a&&!a.correct).map(a=>a.term)};
    const nh=[attempt,...hist].slice(0,50); setHist(nh); await sSet("test:history",nh);
  })(); },[view]);

  const score=answers.filter(a=>a&&a.correct).length;
  const best=hist.reduce((m,a)=>Math.max(m,a.pct),0);
  const btn={border:"1px solid var(--line2)",background:"var(--bg)",color:"var(--bone)",borderRadius:10,padding:"13px 15px",fontSize:15,cursor:"pointer",textAlign:"left",fontFamily:"inherit",width:"100%"};

  // ---- HOME ----
  if(view==="home") return (
    <div>
      <div className="card" style={{padding:20,marginBottom:16}}>
        <div className="eyebrow" style={{marginBottom:5}}>Test yourself</div>
        <div className="disp" style={{fontSize:25,fontWeight:800,marginBottom:8}}>Do you actually know it?</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.65}}>Ten questions pulled from the glossary. Start with the <b style={{color:"var(--bone)"}}>Basics</b> and work up. Every answer shows you the concept (with its diagram), it grades you at the end, and it remembers what you miss so you can review the weak spots.</div>
        {hist.length>0 && <div className="mono" style={{fontSize:12.5,color:"var(--faint)",marginTop:12}}>Best score: <b style={{color:testGrade(best)[1]}}>{best}%</b> · {hist.length} test{hist.length===1?"":"s"} taken · <span onClick={()=>setView("progress")} style={{color:"var(--brass)",cursor:"pointer",textDecoration:"underline"}}>see progress →</span></div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12}}>
        {TEST_LEVELS.map(lv=>(
          <button key={lv.id} onClick={()=>start(lv)} style={btn} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--brass)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--line2)"}>
            <div className="disp" style={{fontSize:17,fontWeight:800,color:"var(--brass)",marginBottom:5}}>{lv.id===1?"① ":lv.id===2?"② ":lv.id===3?"③ ":"★ "}{lv.name}</div>
            <div style={{fontSize:13,color:"var(--dim)",lineHeight:1.5}}>{lv.blurb}</div>
          </button>))}
      </div>
    </div>
  );

  // ---- QUIZ ----
  if(view==="quiz"){
    const q=qs[i]; if(!q) return null;
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <button className="btn" onClick={()=>setView("home")} style={{padding:"6px 12px",fontSize:12.5}}>← Quit</button>
          <span className="eyebrow">{level&&level.name} · Q{i+1} of {qs.length}</span>
          <span className="mono" style={{marginLeft:"auto",fontSize:13,color:"var(--brass)"}}>Score {score}/{answers.filter(Boolean).length}</span>
        </div>
        <div style={{height:5,background:"var(--bg3)",borderRadius:3,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:`${(i/qs.length)*100}%`,background:"var(--brass)"}}/></div>
        <div className="card" style={{padding:20,marginBottom:14}}>
          <div className="eyebrow" style={{marginBottom:8}}>Which term is this?</div>
          <div style={{fontSize:16.5,color:"var(--bone)",lineHeight:1.55,fontWeight:500}}>{q.prompt}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {q.options.map((opt,k)=>{
            const isAns=opt===q.answer, isPicked=opt===picked, show=picked!=null;
            const bc=show&&isAns?"var(--bull)":show&&isPicked&&!isAns?"var(--bear)":"var(--line2)";
            const bg=show&&isAns?"rgba(63,183,130,0.10)":show&&isPicked&&!isAns?"rgba(231,106,91,0.10)":"var(--bg)";
            return (
              <button key={k} onClick={()=>choose(opt)} disabled={show} style={{...btn,borderColor:bc,background:bg,cursor:show?"default":"pointer",display:"flex",alignItems:"center",gap:10}}>
                <span className="mono" style={{fontSize:12,color:"var(--faint)",flexShrink:0}}>{String.fromCharCode(65+k)}</span>
                <span style={{fontSize:15,fontWeight:600,color:show&&isAns?"var(--bull)":"var(--bone)"}}>{opt}</span>
                {show&&isAns && <span style={{marginLeft:"auto",color:"var(--bull)"}}>✓</span>}
                {show&&isPicked&&!isAns && <span style={{marginLeft:"auto",color:"var(--bear)"}}>✗</span>}
              </button>);
          })}
        </div>
        {picked!=null && <div className="card" style={{padding:16,marginTop:14,borderColor:picked===q.answer?"var(--bull)":"var(--bear)"}}>
          <div style={{fontSize:14,fontWeight:700,color:picked===q.answer?"var(--bull)":"var(--bear)",marginBottom:6}}>{picked===q.answer?"Correct":`Not quite — it's ${q.answer}`}</div>
          <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.55}}>{q.prompt}</div>
          {q.dia && <StratDia kind={q.dia}/>}
          <button className="btn btn-primary" onClick={next} style={{marginTop:13,padding:"9px 16px"}}>{i+1<qs.length?"Next question →":"See my score →"}</button>
        </div>}
      </div>
    );
  }

  // ---- RESULT ----
  if(view==="result"){
    const total=qs.length, pct=Math.round(score/total*100), [gr,gc]=testGrade(pct);
    const missed=answers.filter(a=>a&&!a.correct);
    return (
      <div>
        <div className="card" style={{padding:24,marginBottom:16,textAlign:"center"}}>
          <div className="eyebrow" style={{marginBottom:6}}>{level&&level.name} · complete</div>
          <div className="mono" style={{fontSize:60,fontWeight:800,lineHeight:1,color:gc}}>{gr}</div>
          <div className="mono" style={{fontSize:20,fontWeight:800,marginTop:6}}>{score}/{total} · {pct}%</div>
          <div style={{fontSize:14,color:"var(--dim)",marginTop:8}}>{pct>=80?"Sharp. You know this cold.":pct>=60?"Solid base — tighten the misses below.":"Worth another pass. Review the terms below, then retake."}</div>
          <div style={{display:"flex",gap:9,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>
            <button className="btn btn-primary" onClick={()=>start(level)} style={{padding:"9px 16px"}}>↻ Retake</button>
            <button className="btn" onClick={()=>setView("home")} style={{padding:"9px 16px"}}>Pick another level</button>
            <button className="btn" onClick={()=>setView("progress")} style={{padding:"9px 16px"}}>My progress →</button>
          </div>
        </div>
        {missed.length>0 && <div className="card" style={{padding:18}}>
          <div className="eyebrow" style={{marginBottom:4}}>What to review</div>
          <div style={{fontSize:13.5,color:"var(--dim)",marginBottom:12}}>The {missed.length} you missed — study these, then retake.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
            {missed.map((a,k)=>(
              <div key={k} style={{padding:13,background:"var(--bg)",border:"1px solid var(--line)",borderRadius:11}}>
                <div className="disp" style={{fontSize:15.5,fontWeight:700,color:"var(--brass)",marginBottom:5}}>{a.term}</div>
                <div style={{fontSize:13.5,color:"var(--comp)",lineHeight:1.5}}>{a.prompt}</div>
                {a.dia && <StratDia kind={a.dia}/>}
              </div>))}
          </div>
        </div>}
        {missed.length===0 && <div className="card" style={{padding:20,textAlign:"center",fontSize:15,color:"var(--bull)"}}>Perfect run — nothing to review. 🎯</div>}
      </div>
    );
  }

  // ---- PROGRESS ----
  const weakList=[];
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn" onClick={()=>setView("home")} style={{padding:"6px 12px",fontSize:12.5}}>← Back</button>
        <div className="disp" style={{fontSize:22,fontWeight:800}}>Your progress</div>
      </div>
      {hist.length===0
        ? <div className="card" style={{padding:20,color:"var(--dim)",fontSize:14}}>No tests taken yet. Run one from the levels screen and your scores land here.</div>
        : (<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
            {[["Tests taken",hist.length,"var(--bone)"],["Best score",best+"%",testGrade(best)[1]],["Last score",hist[0].pct+"%",testGrade(hist[0].pct)[1]],["Avg score",Math.round(hist.reduce((s,a)=>s+a.pct,0)/hist.length)+"%","var(--brass)"]].map(([l,v,c],k)=>(
              <div key={k} className="card" style={{padding:13}}><div className="eyebrow" style={{fontSize:10,marginBottom:4}}>{l}</div><div className="mono" style={{fontSize:22,fontWeight:800,color:c,lineHeight:1.1}}>{v}</div></div>))}
          </div>
          <div className="card" style={{padding:16}}>
            <div className="eyebrow" style={{marginBottom:11}}>Recent tests</div>
            {hist.slice(0,12).map((a,k)=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid var(--line)",flexWrap:"wrap"}}>
                <span className="mono" style={{fontSize:13.5,fontWeight:800,color:testGrade(a.pct)[1],minWidth:34}}>{testGrade(a.pct)[0]}</span>
                <span style={{fontSize:13.5,fontWeight:600,color:"var(--bone)",flex:"1 1 120px"}}>{a.level}</span>
                <span className="mono" style={{fontSize:13,color:"var(--dim)"}}>{a.score}/{a.total} · {a.pct}%</span>
                <span className="mono" style={{fontSize:12,color:"var(--faint)"}}>{new Date(a.ts).toLocaleDateString([],{month:"short",day:"numeric"})}</span>
              </div>))}
          </div>
        </>)}
    </div>
  );
}
function GlossaryView(){
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:16,alignItems:"start"}}>
      {GLOSSARY.map((g,i)=>(
        <div key={i} className="card" style={{padding:"16px 18px"}}>
          <div className="disp" style={{fontSize:15,fontWeight:700,color:"var(--bone)",marginBottom:4}}>{g.cat}</div>
          <div className="eyebrow" style={{marginBottom:6}}>{g.sub}</div>
          {g.items.map((it,j)=>(
            <div key={j} className="gloss-row">
              <div className="gloss-term">{it.term}</div>
              <div className="gloss-def" dangerouslySetInnerHTML={{__html:it.def}}/>
              {it.dia && <StratDia kind={it.dia}/>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ============================ REVIEW (weekly trade-log chart) ============================ */
const RV_STYLE = `
.tlp{
  --bg:#0E1116; --bg2:#151A21; --bg3:#1B2129;
  --line:#262E38; --line2:#333D49;
  --bone:#E9E6DF; --dim:#8792A0; --faint:#5A636F;
  --brass:#E3A857; --brass-dim:#A8813F;
  --bull:#3FB782; --bear:#E76A5B; --focus:#6FA8DC;
  font-family:'Inter',sans-serif; color:var(--bone); letter-spacing:-0.01em;
}
.tlp *{box-sizing:border-box;}
.tlp .mono{font-family:'JetBrains Mono',monospace;}
.tlp .disp{font-family:'Archivo',sans-serif;}
.tlp .eyebrow{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.18em;font-size:10px;color:var(--dim);}
.tlp h1{font-family:'Archivo',sans-serif;font-weight:800;font-size:26px;margin:6px 0 2px;letter-spacing:-0.02em;}
.tlp .sub{color:var(--dim);font-size:13px;margin-bottom:22px;}
.tlp .card{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:16px 16px 14px;margin-bottom:14px;}
.tlp .card.win{border-left:3px solid var(--bull);}
.tlp .card.loss{border-left:3px solid var(--bear);}
.tlp .rowtop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
.tlp .tick{font-family:'Archivo',sans-serif;font-weight:700;font-size:16px;}
.tlp .pl{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:19px;text-align:right;}
.tlp .pl small{display:block;font-size:11px;font-weight:500;opacity:.75;letter-spacing:0;}
.tlp .up{color:var(--bull);} .tlp .down{color:var(--bear);}
.tlp .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:14px 0 4px;}
.tlp .cell{background:var(--bg3);padding:9px 10px;}
.tlp .cell .k{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--faint);}
.tlp .cell .v{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;margin-top:3px;}
.tlp .scorehead{display:flex;align-items:center;gap:8px;margin:16px 0 8px;}
.tlp .scorehead .bar{flex:1;height:1px;background:var(--line2);}
.tlp .checks{display:flex;flex-direction:column;gap:6px;}
.tlp .chk{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.45;}
.tlp .mark{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:12px;width:15px;flex:none;text-align:center;padding-top:1px;}
.tlp .chk .lbl{color:var(--bone);font-weight:500;}
.tlp .chk .why{color:var(--dim);}
.tlp .verdict{margin-top:13px;padding:10px 12px;border-radius:8px;background:var(--bg3);border:1px solid var(--line2);font-size:12.5px;line-height:1.5;color:var(--bone);}
.tlp .verdict b{color:var(--brass);font-weight:600;}
.tlp .chartwrap{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:16px 12px 10px;margin-bottom:14px;}
.tlp .legend{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:6px;font-size:11px;color:var(--dim);}
.tlp .legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px;}
.tlp .tabs{display:flex;gap:6px;margin-bottom:14px;}
.tlp .tab{flex:1;background:var(--bg2);border:1px solid var(--line);color:var(--dim);border-radius:8px;padding:8px 6px;font-size:12px;font-weight:600;cursor:pointer;transition:.15s;}
.tlp .tab:hover{border-color:var(--line2);color:var(--bone);}
.tlp .tab.on{background:var(--bg3);border-color:var(--brass-dim);color:var(--brass);}
.tlp .note{font-size:11.5px;color:var(--faint);line-height:1.5;margin-top:18px;padding-top:12px;border-top:1px solid var(--line);}
@media (max-width:520px){.tlp .grid{grid-template-columns:repeat(2,1fr);}.tlp h1{font-size:22px;}}
`;

const RV_TRADES = [
  { id:"t1", kind:"loss", tick:"IWM $290 PUT", when:"Jul 28 · expired Jul 28 (0DTE)", entry:"$0.06", exit:"$0.03", qty:"10", under:"294.00", pl:-29.88, plPct:"-49.5%",
    checks:[[false,"Expiration","Bought 11:31 AM, expired 4:00 PM. Four hours."],[false,"Strike distance","$4 out of the money. Delta ~0.05."],[false,"Bid/ask","$0.03 / $0.06 — 50% toll paid on entry."],[false,"Premium floor","$0.06. Far below the $0.50 minimum."],[true,"Position size","$60 total risk. Small enough to survive."],[true,"Direction","Called it down. IWM did fall."]],
    verdict:"Right direction, wrong instrument. IWM reached $289.12 within three days — the read was correct. A Jul 31 expiration on the same strike would have roughly doubled. The clock, not the call, decided this one." },
  { id:"t2", kind:"win", tick:"IWM $292 CALL", when:"Jul 30 · expired Jul 30 (0DTE)", entry:"$0.18", exit:"$0.45", qty:"1", under:"292.28", pl:27.0, plPct:"+150%",
    checks:[[false,"Expiration","Same-day. ~37 minutes left at the screenshot."],[false,"Strike distance","Out of the money until the final run."],[true,"Bid/ask","Tighter than the Jul 28 contract, but still wide."],[false,"Premium floor","$0.18. Below the $0.50 minimum."],[true,"Position size","1 contract. $18 at risk."],[true,"Direction","Called the move up. IWM ran to $292.28."]],
    verdict:"Won on the same structure that lost on Jul 28. That is the point worth keeping: outcome and process came apart here. A 29-cent slip before the bell takes this to zero with nothing to sell." },
];

const RV_PATH = [
  { t:"7/28 11:31", p:294.0, mark:"t1" },
  { t:"7/28 close", p:292.92 },
  { t:"7/29", p:292.92 },
  { t:"7/30 12:32", p:289.12 },
  { t:"7/30 12:37", p:288.31 },
  { t:"7/30 15:17", p:289.18 },
  { t:"7/30 15:23", p:292.28, mark:"t2" },
];

function RvChart(){
  const W=640,H=250,PL=46,PR=16,PT=18,PB=34;
  const iw=W-PL-PR, ih=H-PT-PB;
  const ps=RV_PATH.map(d=>d.p);
  const lo=Math.floor(Math.min(...ps)-1), hi=Math.ceil(Math.max(...ps)+1);
  const x=i=>PL+(i/(RV_PATH.length-1))*iw;
  const y=p=>PT+ih-((p-lo)/(hi-lo))*ih;
  const line=RV_PATH.map((d,i)=>`${i?"L":"M"}${x(i)},${y(d.p)}`).join(" ");
  const area=`${line} L${x(RV_PATH.length-1)},${PT+ih} L${x(0)},${PT+ih} Z`;
  const ticks=[]; for(let v=lo;v<=hi;v+=2) ticks.push(v);
  return (
    <div className="chartwrap">
      <div className="eyebrow" style={{marginBottom:8,paddingLeft:4}}>IWM · both entries</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}} role="img" aria-label="IWM price path with both trade entries marked">
        <defs><linearGradient id="tlpFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E3A857" stopOpacity="0.16"/><stop offset="100%" stopColor="#E3A857" stopOpacity="0"/></linearGradient></defs>
        {ticks.map(v=>(<g key={v}><line x1={PL} y1={y(v)} x2={W-PR} y2={y(v)} stroke="#262E38" strokeWidth="1"/><text x={PL-8} y={y(v)+4} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#5A636F">{v}</text></g>))}
        <path d={area} fill="url(#tlpFill)"/>
        <path d={line} fill="none" stroke="#E3A857" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        {RV_PATH.map((d,i)=>{ const isMark=!!d.mark; const col=d.mark==="t1"?"#E76A5B":d.mark==="t2"?"#3FB782":"#8792A0"; return (
          <g key={i}><circle cx={x(i)} cy={y(d.p)} r={isMark?5.5:2.5} fill={isMark?col:"#151A21"} stroke={col} strokeWidth={isMark?2:1.5}/>{isMark&&(<text x={x(i)} y={y(d.p)-13} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="10" fontWeight="700" fill={col}>{d.mark==="t1"?"PUT":"CALL"}</text>)}</g>
        );})}
        {RV_PATH.map((d,i)=> (i%2===0||d.mark)?(<text key={`x${i}`} x={x(i)} y={H-12} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#5A636F">{d.t}</text>):null)}
      </svg>
      <div className="legend">
        <span><i style={{background:"#E76A5B"}}/>Jul 28 put entry · 294.00</span>
        <span><i style={{background:"#3FB782"}}/>Jul 30 call · 292.28</span>
      </div>
    </div>
  );
}

function RvCard({t}){
  const up=t.pl>0;
  return (
    <div className={`card ${t.kind}`}>
      <div className="rowtop">
        <div><div className="tick">{t.tick}</div><div className="eyebrow" style={{marginTop:4}}>{t.when}</div></div>
        <div className={`pl ${up?"up":"down"}`}>{up?"+":"\u2212"}${Math.abs(t.pl).toFixed(2)}<small>{t.plPct}</small></div>
      </div>
      <div className="grid">
        <div className="cell"><div className="k">Entry</div><div className="v">{t.entry}</div></div>
        <div className="cell"><div className="k">Exit</div><div className="v">{t.exit}</div></div>
        <div className="cell"><div className="k">Contracts</div><div className="v">{t.qty}</div></div>
        <div className="cell"><div className="k">IWM</div><div className="v">{t.under}</div></div>
      </div>
      <div className="scorehead"><span className="eyebrow">Structure</span><span className="bar"/><span className="mono" style={{fontSize:12.5,color:"#8792A0"}}>{t.checks.filter(c=>c[0]).length}/6</span></div>
      <div className="checks">
        {t.checks.map(([ok,lbl,why],i)=>(<div className="chk" key={i}><span className="mark" style={{color:ok?"#3FB782":"#E76A5B"}}>{ok?"\u2713":"\u2715"}</span><span><span className="lbl">{lbl}</span>{" \u2014 "}<span className="why">{why}</span></span></div>))}
      </div>
      <div className="verdict">{t.verdict}</div>
    </div>
  );
}

function ReviewPanel({trades=[]}){
  const [view,setView]=useState("both");
  const shown = view==="both" ? RV_TRADES : RV_TRADES.filter(t=>t.id===view);
  const pnls=trades.map(computePnl).filter(p=>p!=null);
  const total=pnls.reduce((a,b)=>a+b,0);
  const gp=pnls.filter(p=>p>0).reduce((a,b)=>a+b,0);
  const gl=pnls.filter(p=>p<0).reduce((a,b)=>a+b,0);
  const winN=pnls.filter(p=>p>0).length, lossN=pnls.filter(p=>p<0).length;
  const pf=gl!==0?Math.abs(gp/gl):(gp>0?Infinity:0);
  const tile=(label,val,color)=>(
    <div style={{padding:"13px 14px",background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:11}}>
      <div className="eyebrow" style={{marginBottom:6}}>{label}</div>
      <div className="mono" style={{fontSize:18,fontWeight:800,color:color||"var(--bone)",lineHeight:1}}>{val}</div>
    </div>
  );
  return (
    <div className="tlp">
      <style>{RV_STYLE}</style>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}><div className="eyebrow">Account review</div><Help text="Your all-time totals from every logged trade. Total P&L = net. Gross profit = sum of winners, gross loss = sum of losers. Profit factor = gross profit ÷ gross loss (above 1.0 = making money; below = losing). Below is the Jul 28 weekly recap."/></div>
      <h1 className="disp" style={{marginBottom:14}}>Profit & loss</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {tile("Total P&L", pnls.length?fmtMoney(total):"—", total>=0?"var(--bull)":"var(--bear)")}
        {tile("Gross profit", pnls.length?fmtMoney(gp):"—", "var(--bull)")}
        {tile("Gross loss", pnls.length?fmtMoney(gl):"—", "var(--bear)")}
        {tile("Record", pnls.length?`${winN}W · ${lossN}L`:"—")}
        {tile("Profit factor", pnls.length?(pf===Infinity?"∞":pf.toFixed(2)):"—", pf>=1?"var(--bull)":"var(--bear)")}
      </div>

      <div style={{height:1,background:"var(--line)",margin:"6px 0 18px"}}/>
      <div className="eyebrow">Trade log</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><h1 className="disp">Week of Jul 28</h1><Help text="A visual recap: the IWM price path with your entries marked, plus each trade graded against six structure rules — independent of P&L. A trade can score badly and still win (that's the Jul 30 card)."/></div>
      <div className="sub">Two trades. Opposite outcomes, near-identical structure. (Also logged in your Journal.)</div>
      <RvChart/>
      <div className="tabs">
        <button className={`tab ${view==="both"?"on":""}`} onClick={()=>setView("both")}>Both</button>
        <button className={`tab ${view==="t1"?"on":""}`} onClick={()=>setView("t1")}>Jul 28 put</button>
        <button className={`tab ${view==="t2"?"on":""}`} onClick={()=>setView("t2")}>Jul 30 call</button>
      </div>
      {shown.map(t=><RvCard key={t.id} t={t}/>)}
      <div className="note">Structure is graded against six entry rules, independent of profit and loss. A trade can score badly and still win — that's what the Jul 30 card records. Price anchors are from timestamped screenshots and approximate between points.</div>
    </div>
  );
}
