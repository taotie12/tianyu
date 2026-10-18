import {Capacitor,registerPlugin} from '@capacitor/core';
import {normalizeCalendarStore} from './calendars';

const ShiftWidget=registerPlugin('ShiftWidget');
const STORAGE='sanzhi-calendar-v1';
let queue=Promise.resolve();

// Read committed data inside the queue. Widgets work independently of alarm
// permissions and keep the entire calendar so Android can roll over each day.
export function syncStoredWidget({store=localStorage}={}){
 const task=queue.catch(()=>{}).then(async()=>{
  if(!Capacitor.isNativePlatform())return null;
  const data=normalizeCalendarStore(JSON.parse(store.getItem(STORAGE)||'null'));
  if(!data)return null;
  return ShiftWidget.sync({team:data.team,schedule:data.schedule,times:data.settings.times,bus:data.settings.routine.bus});
 });
 queue=task;return task;
}
export async function widgetStatus(){
 if(!Capacitor.isNativePlatform())return {supported:false,count:0};
 return ShiftWidget.status();
}
export async function requestWidget(size='4x2'){
 if(!['4x2','2x2'].includes(size))throw Error('请选择 4×2 或 2×2 小部件');
 if(!Capacitor.isNativePlatform())return {requested:false};
 await syncStoredWidget();
 return ShiftWidget.pin({size});
}
