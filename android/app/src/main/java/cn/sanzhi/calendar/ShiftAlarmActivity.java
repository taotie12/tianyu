package cn.sanzhi.calendar;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.*;
public class ShiftAlarmActivity extends Activity {
 @Override public void onCreate(Bundle state){super.onCreate(state);
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON|WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED|WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setGravity(Gravity.CENTER);layout.setPadding(40,60,40,60);layout.setBackgroundColor(Color.rgb(237,247,240));
  TextView brand=new TextView(this);brand.setText("值日 · 上班提醒");brand.setTextSize(17);brand.setTextColor(Color.rgb(20,125,101));layout.addView(brand);
  TextView title=new TextView(this);title.setText(getIntent().getStringExtra("title"));title.setTextSize(32);title.setTextColor(Color.rgb(37,61,53));title.setGravity(Gravity.CENTER);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,45,0,25);layout.addView(title,p);
  TextView body=new TextView(this);body.setText(getIntent().getStringExtra("body"));body.setTextSize(17);body.setGravity(Gravity.CENTER);layout.addView(body);
  Button dismiss=new Button(this);dismiss.setText("停止响铃");LinearLayout.LayoutParams b=new LinearLayout.LayoutParams(-1,150);b.setMargins(0,80,0,15);layout.addView(dismiss,b);dismiss.setOnClickListener(v->done(false));
  Button snooze=new Button(this);snooze.setText("再提醒一次 · 10 分钟后");layout.addView(snooze,new LinearLayout.LayoutParams(-1,150));snooze.setOnClickListener(v->done(true));setContentView(layout);
 }
 private void done(boolean snooze){stopService(new Intent(this,ShiftAlarmService.class));if(snooze)ShiftAlarmPlugin.snooze(this,getIntent());finish();}
}
