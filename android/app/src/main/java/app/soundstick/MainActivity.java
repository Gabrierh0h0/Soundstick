package app.soundstick;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WaCorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
