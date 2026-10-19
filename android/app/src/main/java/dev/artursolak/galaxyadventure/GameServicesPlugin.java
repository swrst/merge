package dev.artursolak.galaxyadventure;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;

import java.nio.charset.StandardCharsets;

/**
 * Google Play Games Services v2 for the game: automatic sign-in, cloud save
 * (Saved Games), leaderboards and achievements. The JS side is
 * src/services/games.ts.
 *
 * Nothing runs until the Play Games project id is filled in
 * (res/values/strings.xml → game_services_project_id); until then every call
 * answers "not configured" and the game keeps its local save only.
 */
@CapacitorPlugin(name = "GameServices")
public class GameServicesPlugin extends Plugin {
    private static boolean ready = false;

    /** called from MainActivity.onCreate */
    static void init(Context ctx) {
        int id = ctx.getResources().getIdentifier("game_services_project_id", "string", ctx.getPackageName());
        String pid = id == 0 ? "" : ctx.getString(id).trim();
        if (pid.isEmpty() || pid.startsWith("0000")) return;
        PlayGamesSdk.initialize(ctx);
        ready = true;
    }

    private boolean check(PluginCall call) {
        if (!ready) { call.reject("not configured"); return false; }
        if (getActivity() == null) { call.reject("no activity"); return false; }
        return true;
    }

    @PluginMethod
    public void isConfigured(PluginCall call) {
        JSObject r = new JSObject(); r.put("configured", ready); call.resolve(r);
    }

    /** silent: true only checks the automatic sign-in; false shows Google's sign-in sheet */
    @PluginMethod
    public void signIn(PluginCall call) {
        if (!check(call)) return;
        Activity a = getActivity();
        boolean silent = Boolean.TRUE.equals(call.getBoolean("silent", false));
        PlayGames.getGamesSignInClient(a).isAuthenticated().addOnCompleteListener(t -> {
            boolean ok = t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated();
            if (ok) { player(call); return; }
            if (silent) { JSObject r = new JSObject(); r.put("signedIn", false); call.resolve(r); return; }
            PlayGames.getGamesSignInClient(a).signIn().addOnCompleteListener(t2 -> {
                boolean ok2 = t2.isSuccessful() && t2.getResult() != null && t2.getResult().isAuthenticated();
                if (ok2) player(call);
                else { JSObject r = new JSObject(); r.put("signedIn", false); call.resolve(r); }
            });
        });
    }

    private void player(PluginCall call) {
        PlayGames.getPlayersClient(getActivity()).getCurrentPlayer().addOnCompleteListener(t -> {
            JSObject r = new JSObject(); r.put("signedIn", true);
            JSObject p = new JSObject();
            if (t.isSuccessful() && t.getResult() != null) {
                p.put("displayName", t.getResult().getDisplayName());
                p.put("playerId", t.getResult().getPlayerId());
            }
            r.put("player", p);
            call.resolve(r);
        });
    }

    /** writes the save under one name; offline saves are kept and synced by Play Games */
    @PluginMethod
    public void saveGame(PluginCall call) {
        if (!check(call)) return;
        String title = call.getString("title", "galaxy-adventure");
        String data = call.getString("data", "");
        String desc = call.getString("description", "Galaxy Adventure");
        SnapshotsClient sc = PlayGames.getSnapshotsClient(getActivity());
        sc.open(title, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
            .continueWithTask(t -> {
                Snapshot s = t.getResult().getData();
                s.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
                SnapshotMetadataChange ch = new SnapshotMetadataChange.Builder().setDescription(desc).build();
                return sc.commitAndClose(s, ch);
            })
            .addOnSuccessListener(m -> call.resolve())
            .addOnFailureListener(e -> call.reject("save failed: " + e.getMessage()));
    }

    /** reads the save; resolves {} when there is none yet */
    @PluginMethod
    public void loadGame(PluginCall call) {
        if (!check(call)) return;
        String title = call.getString("title", "galaxy-adventure");
        SnapshotsClient sc = PlayGames.getSnapshotsClient(getActivity());
        sc.open(title, false, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
            .addOnSuccessListener(dc -> {
                JSObject r = new JSObject();
                Snapshot s = dc.getData();
                if (s == null) { call.resolve(r); return; }
                try {
                    r.put("data", new String(s.getSnapshotContents().readFully(), StandardCharsets.UTF_8));
                    r.put("modified", s.getMetadata().getLastModifiedTimestamp());
                } catch (Exception e) { /* unreadable: treat as none */ }
                sc.discardAndClose(s);
                call.resolve(r);
            })
            .addOnFailureListener(e -> call.resolve(new JSObject()));   // not found (or offline): no cloud save
    }

    @PluginMethod
    public void submitScore(PluginCall call) {
        if (!check(call)) return;
        String id = call.getString("leaderboardId", "");
        Long score = call.getLong("score", 0L);
        if (!id.isEmpty()) PlayGames.getLeaderboardsClient(getActivity()).submitScore(id, score == null ? 0 : score);
        call.resolve();
    }

    @PluginMethod
    public void showLeaderboard(PluginCall call) {
        if (!check(call)) return;
        String id = call.getString("leaderboardId", "");
        PlayGames.getLeaderboardsClient(getActivity()).getLeaderboardIntent(id)
            .addOnSuccessListener(i -> { getActivity().startActivityForResult(i, 9004); call.resolve(); })
            .addOnFailureListener(e -> call.reject(e.getMessage()));
    }

    @PluginMethod
    public void unlockAchievement(PluginCall call) {
        if (!check(call)) return;
        String id = call.getString("achievementId", "");
        // only ids that look like Play Console ones ("Cgk…"); in-game names are skipped
        if (id.startsWith("Cg")) PlayGames.getAchievementsClient(getActivity()).unlock(id);
        call.resolve();
    }
}
