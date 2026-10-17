import React,{useEffect,useRef,useState} from 'react';
import {Trash2,Loader2,ScanLine} from 'lucide-react';
import Modal from './Modal';

export default function GroupManager({profiles,team,onDelete,onImport,onClose}){
 const[pending,setPending]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const cancel=useRef();
 useEffect(()=>{if(pending)cancel.current?.focus({preventScroll:true});},[pending]);
 const remaining=profiles.filter(p=>p.team!==pending),active=pending===team;
 async function remove(){setBusy(true);setError('');try{await onDelete(pending);setPending(null);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <Modal title="管理班组" description="管理保存在本机的班组和大修排班。" onClose={()=>{if(!busy)onClose();}}>
  {pending?<section className="group-confirm" aria-label="确认删除班组"><h3>确认删除“{pending}”？</h3><p>将删除这个班组在本机的排班和手动调整。其他班组、起床与班车时间保留；需要时可以重新扫码导入。</p><p className="notice">{active?(remaining.length?`这是当前班组。删除后切换到${remaining[0].team}，并关闭闹钟。需要提醒时，请在“提醒”重新开启。`:'这是最后一个班组。删除后日历为空，闹钟关闭，可重新导入排班。'):'这不是当前班组，当前日历和闹钟保持不变。'}</p><div className="two-fields actions"><button ref={cancel} className="btn secondary" disabled={busy} onClick={()=>{setPending(null);setError('');}}>取消</button><button className="btn danger" disabled={busy} onClick={remove}>{busy?<Loader2 size={17} className="spin"/>:<Trash2 size={17}/>}确认删除</button></div></section>:profiles.length?<div className="group-list">{profiles.map(profile=>{const dates=Object.keys(profile.schedule).sort();return <div className="group-row" key={profile.team}><div><strong>{profile.team}</strong>{team===profile.team&&<span className="group-current">当前班组</span>}<p>{dates.length} 天{dates.length?` · ${dates[0]} 至 ${dates.at(-1)}`:''}</p></div><button className="btn delete-group" aria-label={`删除${profile.team}`} onClick={()=>{setPending(profile.team);setError('');}}><Trash2 size={16}/>删除</button></div>;})}</div>:<div className="group-empty"><h3>还没有班组</h3><p>导入二维码或 Excel，建立你的倒班日历。</p><button className="btn primary full" onClick={onImport}><ScanLine size={17}/>导入班组</button></div>}
  {error&&<p className="error" role="alert">{error}</p>}
 </Modal>;
}
