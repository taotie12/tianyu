package cn.sanzhi.calendar;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.util.*;

/** Vendor switches have no portable read/grant API. Open settings on user tap. */
final class AlarmSettings {
 private static Intent component(String pkg,String cls){return new Intent().setComponent(new ComponentName(pkg,cls));}
 static boolean open(Activity activity,String target){
  String pkg=activity.getPackageName();Uri uri=Uri.parse("package:"+pkg);
  List<Intent> candidates=new ArrayList<>();
  switch(target){
   case "notifications":
    if(Build.VERSION.SDK_INT>=26)candidates.add(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,pkg));break;
   case "channel":
    if(Build.VERSION.SDK_INT>=26)candidates.add(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,pkg).putExtra(Settings.EXTRA_CHANNEL_ID,ShiftAlarmPlugin.CHANNEL));break;
   case "exact":
    if(Build.VERSION.SDK_INT>=31)candidates.add(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,uri));break;
   case "fullScreen":
    if(Build.VERSION.SDK_INT>=34)candidates.add(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,uri));
    if(Build.VERSION.SDK_INT>=26)candidates.add(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,pkg));break;
   case "battery":
    candidates.add(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));break;
   case "autostart":
    String brand=Build.MANUFACTURER.toLowerCase(Locale.ROOT);
    if(brand.contains("xiaomi")||brand.contains("redmi"))candidates.add(component("com.miui.securitycenter","com.miui.permcenter.autostart.AutoStartManagementActivity"));
    if(brand.contains("huawei")||brand.contains("honor")){candidates.add(component("com.huawei.systemmanager","com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));candidates.add(component("com.hihonor.systemmanager","com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));}
    if(brand.contains("oppo")||brand.contains("realme")||brand.contains("oneplus")){
     candidates.add(component("com.oplus.safecenter","com.oplus.safecenter.startupapp.StartupAppListActivity"));
     candidates.add(component("com.coloros.safecenter","com.coloros.safecenter.permission.startup.StartupAppListActivity"));
    }
    if(brand.contains("vivo")||brand.contains("iqoo"))candidates.add(component("com.vivo.permissionmanager","com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));break;
   case "vendor":
    if(Build.MANUFACTURER.toLowerCase(Locale.ROOT).contains("xiaomi")||Build.MANUFACTURER.toLowerCase(Locale.ROOT).contains("redmi")){
     candidates.add(new Intent("miui.intent.action.APP_PERM_EDITOR").putExtra("extra_pkgname",pkg));
     candidates.add(component("com.miui.securitycenter","com.miui.permcenter.permissions.PermissionsEditorActivity").putExtra("extra_pkgname",pkg));
     candidates.add(component("com.miui.securitycenter","com.miui.permcenter.permissions.AppPermissionsEditorActivity").putExtra("extra_pkgname",pkg));
    }break;
   default:break;
  }
  for(Intent intent:candidates){try{activity.startActivity(intent);return false;}catch(ActivityNotFoundException|SecurityException ignored){}}
  activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,uri));return !"details".equals(target);
 }
}
