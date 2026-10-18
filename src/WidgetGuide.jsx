import React,{useEffect,useState} from 'react';
import {CalendarDays,Plus,RefreshCw} from 'lucide-react';
import Modal from './Modal';
import {native} from './notifications';
import {addDays,dateKey,dayInfo,DISPLAY_SHIFTS} from './schedule';
import {widgetStatus,requestWidget,syncStoredWidget} from './widgets';

export default function WidgetGuide({team,schedule,settings,issue,onSynced,onClose}){
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{
  let active=true;
  const refresh=()=>widgetStatus().then(result=>{if(active)setStatus(result);}).catch(()=>{if(active)setError('无法读取桌面状态，可按下方步骤手动添加。');});
  refresh();window.addEventListener('sanzhi-native-resume',refresh);
  return()=>{active=false;window.removeEventListener('sanzhi-native-resume',refresh);};
 },[]);
 async function update(pin=false){
  setBusy(true);setError('');setMessage('');
  try{
   if(pin){const result=await requestWidget();setMessage(result.requested?'请在系统弹窗中确认添加。若没有弹窗，请按下方步骤手动添加。':'这个桌面需要手动添加，请按下方步骤操作。');}
   else{await syncStoredWidget();setMessage('已刷新桌面排班。');}
   onSynced();setStatus(await widgetStatus());
  }catch(e){setError(e.message||'小部件同步未完成，请重试。');}finally{setBusy(false);}
 }
 const today=dateKey(),days=Array.from({length:7},(_,i)=>{const date=addDays(today,i);return {date,...dayInfo(schedule,date)};});
 return <Modal title="桌面小部件" description="未来几天上什么班，回到桌面就能看到。" onClose={onClose}>
  <section className="widget-preview" aria-label="桌面七天排班预览">
   <div className="widget-preview-title"><strong>{team||'我的排班'} · 值日</strong><CalendarDays size={20}/></div>
   <p>从今天起 7 天 · 北京时间</p>
   <div className="widget-preview-days">{days.map((day,i)=><div key={day.date} aria-label={`${day.date} ${day.kind?DISPLAY_SHIFTS[day.kind].name:'未排班'}`}><small>{i===0?'今天':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'}).format(new Date(day.date+'T12:00:00+08:00'))}</small><span>{Number(day.date.slice(5,7))}/{Number(day.date.slice(8))}</span><b className={'shift-'+(day.kind||'empty')}>{day.kind?DISPLAY_SHIFTS[day.kind].name:'未排'}</b></div>)}</div>
   <small className="widget-preview-note">{!team?'还没有班组，请先导入排班。':days[0].kind==='U'?`今天上夜 · 今晚 ${settings.routine.bus.N} 班车`:days[0].kind==='L'?`今天下夜 · ${settings.times.N.end} 下班`:'点击桌面小部件，打开完整日历'}</small>
  </section>
  <p className="small muted">小部件跟随应用中当前选择的班组；导入、调整、切换和删除后自动更新。没有排班的日期显示“未排”，不会推算班次。</p>
  {native?<div className="widget-actions">
   {status?.supported&&<button className="btn primary full" disabled={busy} onClick={()=>update(true)}><Plus size={18}/>{busy?'正在处理…':'添加到桌面'}</button>}
   <button className="btn secondary full" disabled={busy} onClick={()=>update()}><RefreshCw size={17}/>刷新桌面排班</button>
   {status&&<p className="small muted">{status.count?`已添加 ${status.count} 个小部件`:'还未添加桌面小部件'}{!status.supported?' · 请使用下面的手动添加方式':''}</p>}
  </div>:<p className="notice">桌面小部件需要安卓安装版。网页版可以预览排班，请在安卓安装版中添加到桌面。</p>}
  {(error||issue)&&<p className="error" role="alert">{error||issue} · 可点击“刷新桌面排班”重试。</p>}
  {message&&<p className="notice" role="status">{message}</p>}
  <h3 className="widget-guide-title">也可以长按桌面添加</h3>
  <ol className="widget-steps"><li>先打开一次新版值日，让排班同步到小部件。</li><li>回到手机桌面，长按空白处（部分手机需要双指捏合）。</li><li>选择「小部件 / 窗口小工具」，找到「值日 · 未来7天排班」。</li><li>拖到桌面，留出约 4 × 3 的空间；长按小部件可以调整大小。</li></ol>
  <p className="small muted">跨天会按北京时间更新；系统省电可能延迟刷新，可点小部件右上角刷新。小部件不需要开启闹钟权限；锁屏和后台响铃仍需单独设置提醒权限。</p>
 </Modal>;
}
