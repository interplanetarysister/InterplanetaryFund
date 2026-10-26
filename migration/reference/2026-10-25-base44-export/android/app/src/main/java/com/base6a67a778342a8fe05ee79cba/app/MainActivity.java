package com.base6a67a778342a8fe05ee79cba.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IfundDiagnosticsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
