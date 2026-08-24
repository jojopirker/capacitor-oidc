package com.jojopirker.capacitor.oidc;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;
import org.json.JSONObject;

@CapacitorPlugin(name = "CapacitorOidc")
public final class CapacitorOidcPlugin extends Plugin {

    private static final String AUTH_SESSION_IN_PROGRESS = "AUTH_SESSION_IN_PROGRESS";
    private static final String USER_CANCELLED = "USER_CANCELLED";
    private static final String BROWSER_UNAVAILABLE = "BROWSER_UNAVAILABLE";
    private static final String INVALID_CALLBACK = "INVALID_CALLBACK";
    private static final String SECURE_STORAGE_ERROR = "SECURE_STORAGE_ERROR";

    private PluginCall pendingAuthCall;
    private Uri pendingCallback;
    private boolean browserOpen;
    private TokenVault vault;

    @Override
    public void load() {
        vault = new TokenVault(getContext());
    }

    @PluginMethod
    public void configure(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void open(PluginCall call) {
        if (pendingAuthCall != null) {
            call.reject("An authentication session is already active.", AUTH_SESSION_IN_PROGRESS);
            return;
        }

        String urlValue = requiredString(call, "url");
        String callbackValue = requiredString(call, "callbackUrl");
        if (urlValue == null || callbackValue == null) return;

        Uri url = Uri.parse(urlValue);
        Uri callback = Uri.parse(callbackValue);
        if (!isSecureRequestUrl(url)) {
            call.reject("The authentication URL must use HTTPS outside loopback development.", BROWSER_UNAVAILABLE);
            return;
        }
        if (!isSupportedCallback(callback)) {
            call.reject("The callback URL must use HTTPS or a custom scheme.", INVALID_CALLBACK);
            return;
        }

        CustomTabsIntent customTab = new CustomTabsIntent.Builder().setShareState(CustomTabsIntent.SHARE_STATE_OFF).build();
        pendingAuthCall = call;
        pendingCallback = callback;
        browserOpen = true;

        try {
            customTab.launchUrl(getContext(), url);
        } catch (ActivityNotFoundException | IllegalStateException error) {
            clearPendingAuth();
            call.reject("No compatible system browser is available.", BROWSER_UNAVAILABLE);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        PluginCall authCall = pendingAuthCall;
        clearPendingAuth();
        if (authCall != null) authCall.reject("The authentication session was cancelled.", USER_CANCELLED);
        call.resolve();
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        Uri callback = intent.getData();
        PluginCall call = pendingAuthCall;
        if (call == null || callback == null || !CallbackUriMatcher.matches(callback, pendingCallback)) return;

        clearPendingAuth();
        JSObject response = new JSObject();
        response.put("url", callback.toString());
        call.resolve(response);
    }

    @Override
    protected void handleOnResume() {
        if (!browserOpen) return;
        PluginCall call = pendingAuthCall;
        clearPendingAuth();
        if (call != null) call.reject("The authentication session was cancelled.", USER_CANCELLED);
    }

    @PluginMethod
    public void storageSet(PluginCall call) {
        String namespace = requiredString(call, "namespace");
        String key = requiredString(call, "key");
        String value = call.getString("value");
        if (namespace == null || key == null) return;
        if (value == null) {
            call.reject("value is required.");
            return;
        }

        try {
            vault.set(namespace, key, value);
            call.resolve();
        } catch (GeneralSecurityException | IOException error) {
            rejectStorage(call);
        }
    }

    @PluginMethod
    public void storageGet(PluginCall call) {
        String namespace = requiredString(call, "namespace");
        String key = requiredString(call, "key");
        if (namespace == null || key == null) return;

        try {
            resolveValue(call, vault.get(namespace, key));
        } catch (GeneralSecurityException | IOException error) {
            rejectStorage(call);
        }
    }

    @PluginMethod
    public void storageRemove(PluginCall call) {
        String namespace = requiredString(call, "namespace");
        String key = requiredString(call, "key");
        if (namespace == null || key == null) return;

        try {
            resolveValue(call, vault.remove(namespace, key));
        } catch (GeneralSecurityException | IOException error) {
            rejectStorage(call);
        }
    }

    @PluginMethod
    public void storageGetAllKeys(PluginCall call) {
        String namespace = requiredString(call, "namespace");
        if (namespace == null) return;

        try {
            List<String> keys = vault.getAllKeys(namespace);
            JSObject result = new JSObject();
            result.put("keys", new JSArray(keys));
            call.resolve(result);
        } catch (GeneralSecurityException | IOException error) {
            rejectStorage(call);
        }
    }

    @PluginMethod
    public void setSessionSnapshot(PluginCall call) {
        String namespace = requiredString(call, "namespace");
        if (namespace == null) return;

        try {
            vault.setSessionSnapshot(namespace, call.getString("value"));
            call.resolve();
        } catch (GeneralSecurityException | IOException error) {
            rejectStorage(call);
        }
    }

    private void clearPendingAuth() {
        pendingAuthCall = null;
        pendingCallback = null;
        browserOpen = false;
    }

    private static String requiredString(PluginCall call, String name) {
        String value = call.getString(name);
        if (value == null || value.isEmpty()) {
            call.reject(name + " is required.");
            return null;
        }
        return value;
    }

    private static boolean isSecureRequestUrl(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (host == null) return false;
        if ("https".equalsIgnoreCase(scheme)) return true;
        return "http".equalsIgnoreCase(scheme) &&
        ("localhost".equalsIgnoreCase(host) ||
            "127.0.0.1".equals(host) ||
            "::1".equals(host) ||
            "[::1]".equals(host));
    }

    private static boolean isSupportedCallback(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null || scheme.isEmpty() || "http".equalsIgnoreCase(scheme)) return false;
        return !"https".equalsIgnoreCase(scheme) || uri.getHost() != null;
    }

    private static void resolveValue(PluginCall call, String value) {
        JSObject result = new JSObject();
        result.put("value", value == null ? JSONObject.NULL : value);
        call.resolve(result);
    }

    private static void rejectStorage(PluginCall call) {
        call.reject("Secure storage failed.", SECURE_STORAGE_ERROR);
    }
}
