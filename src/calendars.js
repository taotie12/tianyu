import {DEFAULT_TEAM,SHIFTS,addDays,validateTeam,validatePayload,unpack,importSummary,normalizeSettings} from './schedule';

function validateSchedule(schedule){
 if(!schedule||typeof schedule!=='object'||Array.isArray(schedule)||Object.entries(schedule).some(([d,c])=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||!SHIFTS[c]||addDays(d,0)!==d))throw Error('本机排班无效');
 return schedule;
}
// Keep the existing key and active schedule for seamless upgrades. Older data
// did not contain a team: those schedules belong to the original 三值 calendar.
export function normalizeCalendarStore(data){
 if(!data)return null;
 const team=data.team===null?null:validateTeam(data.team??DEFAULT_TEAM),schedule=validateSchedule(data.schedule);
 if(!data.settings?.times)throw Error('作息设置缺失');
 const profiles=[];
 if(data.profiles!==undefined&&!Array.isArray(data.profiles))throw Error('值别记录无效');
 for(const profile of data.profiles||[]){
  const name=validateTeam(profile.team);if(profiles.some(p=>p.team===name))throw Error('值别记录重复');
  profiles.push({team:name,schedule:validateSchedule(profile.schedule)});
 }
 const state={...data,team,schedule,profiles,settings:normalizeSettings(data.settings),migrated:data.settings.schemaVersion!==2};
 return updateCalendar(state,schedule,state.settings,team);
}
export function calendarFor(state,team){
 team=validateTeam(team);
 return team===state.team?state.schedule:state.profiles?.find(p=>p.team===team)?.schedule||{};
}
export function updateCalendar(state,schedule,settings,team=state.team===undefined?DEFAULT_TEAM:state.team){
 if(team===null){
  validateSchedule(schedule);
  if(Object.keys(schedule).length||(state.profiles||[]).length)throw Error('无班组状态不能保留排班');
  return {...state,team:null,schedule:{},profiles:[],settings:{...settings,enabled:false}};
 }
 team=validateTeam(team);validateSchedule(schedule);
 let profiles=[...(state.profiles||[])];
 const put=(name,days)=>{profiles=profiles.filter(p=>p.team!==name);profiles.push({team:name,schedule:days});};
 if(state.team!==null&&state.schedule)put(state.team??DEFAULT_TEAM,state.schedule);
 put(team,schedule);
 return {...state,team,schedule,settings,profiles};
}
export function previewImport(payload,state){
 const p=validatePayload(payload);
 return {...importSummary(p,calendarFor(state,p.team)),team:p.team,switching:p.team!==state.team};
}
export function importCalendar(payload,state){
 const p=validatePayload(payload);
 return updateCalendar(state,{...calendarFor(state,p.team),...unpack(p)},state.settings,p.team);
}
export function deleteCalendar(state,team){
 team=validateTeam(team);
 if(!state.profiles?.some(p=>p.team===team))throw Error('未找到该班组，请刷新后重试。');
 const profiles=state.profiles.filter(p=>p.team!==team);
 if(team!==state.team)return {...state,profiles};
 const next=profiles[0];
 return {...state,team:next?.team??null,schedule:next?.schedule??{},profiles,settings:{...state.settings,enabled:false},alarmSyncPending:false};
}
