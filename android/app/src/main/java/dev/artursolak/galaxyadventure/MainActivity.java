package dev.artursolak.galaxyadventure;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GameServicesPlugin.class);   // Play Games: sign-in, cloud save (src/services/games.ts)
        super.onCreate(savedInstanceState);
        GameServicesPlugin.init(this);
    }
}
