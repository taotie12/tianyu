import React,{useEffect,useState} from 'react';
import {ArrowUpRight,Bell,RefreshCw,ShieldCheck} from 'lucide-react';
import Modal from './Modal';
import {native,getAlarmHealth,openAlarmSettings,testNotification} from './notifications';
export const PERMISSIONS_KEY='sanzhi-alarm-permissions-v1';
export function readPermissionReview(){try{return JSON.parse(localStorage.getItem(PERMISSIONS_KEY)||'{}');}catch{return {};}}
export function needsAlarmAttention(h){return h&&(!h.notifications||!h.alarmChannel||!h.exact||!h.fullScreen||!h.battery);}
const manualKeys=['lockscreen','background','autostart'];
export default function AlarmPermissions({onClose,onReviewed,onRefresh,issue}){
 const[health,setHealth]=useState(null),[checks,setChecks]=useState(readPermissionReview),[error,setError]=useState(''),[busy,setBusy]=useState(false),[testMessage,setTestMessage]=useState('');
 async function refresh(){try{setHealth(await getAlarmHealth());setError('');await onRefresh?.();}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();const visible=()=>{if(document.visibilityState==='visible')refresh();};window.addEventListener('sanzhi-native-resume',refresh);document.addEventListener('visibilitychange',visible);return()=>{window.removeEventListener('sanzhi-native-resume',refresh);document.removeEventListener('visibilitychange',visible);};},[]);
 async function open(target){try{const result=await openAlarmSettings(target);if(result?.fallback)setError('此手机没有提供直达入口，已打开应用信息。请按下方说明进入对应设置。');}catch(e){setError(e.message);}}
 function check(key,value){const next={...checks,[key]:value,reviewed:false};try{localStorage.setItem(PERMISSIONS_KEY,JSON.stringify(next));setChecks(next);onReviewed?.(false);}catch{setError('无法保存核对记录，请检查存储空间。');}}
 async function finish(){
  if(!manualKeys.every(k=>checks[k])){setError('请先到系统设置核对锁屏显示、后台弹出和自启动，再勾选对应项目。');return;}
  if(!health||needsAlarmAttention(health)){setError('还有系统权限未开启，请先开启并刷新状态。');return;}
  try{const next={...checks,reviewed:true};localStorage.setItem(PERMISSIONS_KEY,JSON.stringify(next));onReviewed?.(true);onClose();}catch{setError('核对记录保存失败，请重试。');}
 }
 const status=(value)=>!native?'需安装安卓版':!health?'待检测':value?'已开启':'待开启';
 const standard=(title,detail,target,value)=><div className="permission-step"><div className="permission-step-top"><strong>{title}</strong><span className={health&&value?'permission-ok':'permission-pending'}>{status(value)}</span></div><p>{detail}</p><button className="btn secondary" disabled={!native} onClick={()=>open(target)}>去设置<ArrowUpRight size={14}/></button></div>;
 const manual=(key,title,detail,target)=><div className="permission-step"><div className="permission-step-top"><strong>{title}</strong><span className="permission-pending">{checks[key]?'已自行核对':'需手动确认'}</span></div><p>{detail}</p><button className="btn secondary" disabled={!native} onClick={()=>open(target)}>打开相关设置<ArrowUpRight size={14}/></button><label className="checkbox-row"><input type="checkbox" disabled={!native} checked={!!checks[key]} onChange={e=>check(key,e.target.checked)}/>我已在系统设置中核对并允许</label></div>;
 return <Modal title="闹钟权限与后台设置" description="首次开启提醒，请逐项设置。更新手机系统或权限被重置后，也来这里检查。" wide onClose={onClose}>
  <div className="notice"><ShieldCheck size={19}/><span>{native?`${health?.manufacturer||'Android'} 手机 · 返回应用会重新检测系统权限。厂商专有开关无法自动读取，勾选仅表示你已手动核对。`:'以下是安卓安装版的设置指南。网页版不能申请这些权限，也不能保证锁屏和后台响铃。'}</span></div>
  {issue&&<p className="error" role="alert">{issue}。排班和开启提醒的选择已保留，请授权后重试。</p>}
  <div className="permission-steps">
   {standard('1. 允许通知','打开“允许通知”，并允许锁屏通知。进入“上班闹钟”分类，允许悬浮/横幅显示。','notifications',health?.notifications)}
   {standard('2. 允许精确闹钟','在“闹钟和提醒”里允许本应用，保证起床与班车提醒按时触发。','exact',health?.exact)}
   {standard('3. 全屏闹钟与通知分类','Android 14 及以上请允许全屏通知；旧系统在通知设置中允许悬浮/锁屏显示。','fullScreen',health?.fullScreen)}
   {standard('上班闹钟通知分类','该分类需允许通知，并启用悬浮/弹出。响铃使用手机“闹钟音量”，请勿调为零。','channel',health?.alarmChannel)}
   {manual('lockscreen','4. 锁屏显示','小米/红米：应用信息 → 权限管理 → 其他权限 → 锁屏显示，设为允许。其他品牌在应用权限或通知中开启锁屏显示。','vendor')}
   {manual('background','5. 后台弹出界面','小米/红米：权限管理 → 其他权限 → 后台弹出界面，设为允许。其他品牌开启后台弹出、悬浮通知或后台启动界面。','vendor')}
   {manual('autostart','6. 自启动 / 应用启动管理','应用信息 → 自启动，打开开关。华为/荣耀请在应用启动管理中允许自启动、关联启动和后台活动。','autostart')}
   {standard('7. 不限制后台耗电','在电池优化列表切换“所有应用”，选择值日并允许忽略优化；再到应用信息 → 省电策略选“不限制”，关闭后台清理。','battery',health?.battery)}
  </div>
  <div className="permission-tips"><strong>清后台后也能提醒，需要这样设置</strong><p>在最近任务中长按本应用，选择锁定/加锁，避免一键清理。系统闹钟保存在手机上，普通页面刷新不再清空计划；手机重启、更新应用和重新打开时会尝试恢复。</p><p>在系统中“强行停止/结束运行”会阻止闹钟，必须重新打开应用。部分手机的一键清理也会限制自启动，请完成上面的厂商设置后实测。</p><button className="btn secondary" disabled={!native} onClick={()=>open('details')}>打开应用信息<ArrowUpRight size={14}/></button></div>
  {health&&<p className="small muted">本机已保存 {health.count} 个未来闹钟{health.nextAt?`，下一次：${new Date(health.nextAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}`:''}。{health.lastTriggeredAt?`最近一次启动响铃：${new Date(health.lastTriggeredAt).toLocaleString('zh-CN',{hour12:false})}（请自行确认是否听到）。`:''}</p>}
  <button className="btn secondary full" disabled={!native||busy} onClick={async()=>{setBusy(true);setError('');try{await testNotification(30);setTestMessage('测试闹钟已安排，30 秒后响铃。现在返回桌面并锁屏，确认能响铃且显示停止/延后按钮；再测一次清理后台后的情况。');await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}}><Bell size={16}/>30 秒后测试锁屏与后台响铃</button>
  {testMessage&&<p className="test-message" role="status">{testMessage}</p>}
  <button className="btn secondary full permission-refresh" onClick={refresh}><RefreshCw size={16}/>刷新权限并重试恢复闹钟</button>
  {error&&<p className="error" role="alert">{error}</p>}
  <button className="btn primary full" disabled={!native} onClick={finish}>已完成权限核对</button>
 </Modal>;
}
