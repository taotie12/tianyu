import {native,scheduleReminders,restoreReminders,cancelReminders} from './notifications';
export const STORAGE='sanzhi-calendar-v1';
let queue=Promise.resolve();
// All saves/resumes share one queue. A crash leaves the pending marker in
// localStorage so the latest user plan is retried next time the WebView starts.
export function syncStoredReminders({request=false,store=localStorage}={}){
 const run=async()=>{
  if(!native)return 0;
  const raw=store.getItem(STORAGE),data=JSON.parse(raw||'null');if(!data)return 0;
  let count=0;
  if(data.settings.enabled){
   if(data.alarmSyncPending)count=await scheduleReminders(data.schedule,data.settings,{request,team:data.team});
   else{
    const restored=await restoreReminders();count=restored.count;
    if(!count)count=await scheduleReminders(data.schedule,data.settings,{request:false,team:data.team});
   }
  }else if(data.alarmSyncPending)await cancelReminders();
  // A newer save may have arrived while the bridge call was in flight.
  if(store.getItem(STORAGE)===raw&&data.alarmSyncPending){data.alarmSyncPending=false;store.setItem(STORAGE,JSON.stringify(data));}
  return count;
 };
 const task=queue.catch(()=>{}).then(run);queue=task;return task;
}
