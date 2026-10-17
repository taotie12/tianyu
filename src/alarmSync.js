import {native,scheduleReminders,restoreReminders,cancelReminders} from './notifications';
import {normalizeCalendarStore,deleteCalendar} from './calendars';
export const STORAGE='sanzhi-calendar-v1';
let queue=Promise.resolve();
function enqueue(run){const task=queue.catch(()=>{}).then(run);queue=task;return task;}
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
 return enqueue(run);
}
// Cancellation and deletion share the same queue as resume/save. A failed
// cancellation leaves the calendar intact, so an old alarm is never orphaned.
export function deleteStoredCalendar(team,{store=localStorage}={}){
 return enqueue(async()=>{
  const raw=store.getItem(STORAGE),current=normalizeCalendarStore(JSON.parse(raw||'null'));
  if(!current)throw Error('没有可删除的班组。');
  const next=deleteCalendar(current,team);
  const active=team===current.team,alarmsChanged=active||!!current.alarmSyncPending;
  if(active&&native)await cancelReminders();
  // A previous failed switch may have left the old team's native plan running.
  // Finish that outstanding request before deleting an inactive team, too.
  else if(current.alarmSyncPending){
   if(native){
    if(current.settings.enabled)await scheduleReminders(current.schedule,current.settings,{request:false,team:current.team});
    else await cancelReminders();
   }
   next.alarmSyncPending=false;
  }
  if(store.getItem(STORAGE)!==raw)throw Error('排班刚有更新，请重新确认删除。');
  store.setItem(STORAGE,JSON.stringify(next));return {calendar:next,alarmsChanged};
 });
}
