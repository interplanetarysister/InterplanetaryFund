package com.base6a67a778342a8fe05ee79cba.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

// User-controlled crash diagnostics. Never attach IFund account identifiers,
// donation records, email addresses, or credentials to crash reports.
@CapacitorPlugin(name = "IfundDiagnostics")
public class IfundDiagnosticsPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", FirebaseCrashlytics.getInstance().isCrashlyticsCollectionEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("A consent choice is required.");
            return;
        }
        FirebaseCrashlytics diagnostics = FirebaseCrashlytics.getInstance();
        diagnostics.setCrashlyticsCollectionEnabled(enabled);
        if (!enabled) diagnostics.deleteUnsentReports();
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }
}
