package cn.sanzhi.calendar;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state){
  registerPlugin(ShiftAlarmPlugin.class);super.onCreate(state);
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
   @Override public void handleOnBackPressed(){
    if(getBridge()==null||getBridge().getWebView()==null){moveTaskToBack(true);return;}
    // A canceled event means the visible dialog handled the gesture. At the
    // calendar root Android Back simply puts the task in the background.
    getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('sanzhi-android-back',{cancelable:true}))",result->{if(!"false".equals(result))moveTaskToBack(true);});
   }
  });
 }
 @Override public void onResume(){
  super.onResume();
  ShiftAlarmPlugin.WORKER.execute(()->{try{ShiftAlarmPlugin.restore(getApplicationContext());}catch(RuntimeException e){android.util.Log.e("ShiftAlarm","Resume restore failed",e);}});
  if(getBridge()!=null&&getBridge().getWebView()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('sanzhi-native-resume'))",null);
 }
}
