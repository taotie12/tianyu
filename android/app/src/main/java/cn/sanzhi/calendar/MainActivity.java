package cn.sanzhi.calendar;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state){registerPlugin(ShiftAlarmPlugin.class);super.onCreate(state);}
}
