package cn.sanzhi.calendar;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ShiftWidget")
public class ShiftWidgetPlugin extends Plugin {
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();
    @PluginMethod public void sync(PluginCall call) {
        WORKER.execute(() -> {
            try {
                ShiftWidgetStore.save(getContext(), call.getData());
                ShiftWidgetProvider.refreshAll(getContext());
                JSObject result = new JSObject();
                result.put("count", ShiftWidgetProvider.ids(getContext()).length);
                call.resolve(result);
            } catch (Exception error) { call.reject("小部件同步失败：" + error.getMessage(), error); }
        });
    }
    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject();
        boolean supported = Build.VERSION.SDK_INT >= 26 && AppWidgetManager.getInstance(getContext()).isRequestPinAppWidgetSupported();
        result.put("supported", supported);
        result.put("count", ShiftWidgetProvider.ids(getContext()).length);
        call.resolve(result);
    }
    @PluginMethod public void pin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
                boolean requested = Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported()
                        && manager.requestPinAppWidget(new ComponentName(getContext(), ShiftWidgetProvider.class), null, null);
                JSObject result = new JSObject();
                result.put("requested", requested);
                call.resolve(result);
            } catch (RuntimeException error) { call.reject("桌面添加未完成，请长按桌面手动添加", error); }
        });
    }
}
