package com.jojopirker.capacitor.oidc;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import android.content.Intent;
import android.net.Uri;
import androidx.browser.auth.AuthTabIntent;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.Test;
import org.mockito.MockedStatic;

public final class CapacitorOidcPluginTest {

    @Test
    public void resolvesFallbackCallbackBeforeResume() {
        CapacitorOidcPlugin plugin = new CapacitorOidcPlugin();
        RecordingCall call = new RecordingCall();
        Uri expected = uri("capacitor-oidc-example", null, "/callback", null);
        Uri callback = uri("capacitor-oidc-example", null, "/callback", "capacitor-oidc-example:/callback?code=code");
        Intent intent = mock(Intent.class);
        when(intent.getData()).thenReturn(callback);

        plugin.beginAuth(call, expected);
        plugin.handleAuthResult(AuthTabIntent.RESULT_CANCELED, null);
        plugin.handleOnNewIntent(intent);
        plugin.handleOnResume();

        assertNotNull(call.result);
        assertEquals("capacitor-oidc-example:/callback?code=code", call.result.getString("url"));
        assertFalse(call.rejected);
    }

    @Test
    public void rejectsCancellationWhenActivityResumesWithoutCallback() {
        CapacitorOidcPlugin plugin = new CapacitorOidcPlugin();
        RecordingCall call = new RecordingCall();

        plugin.beginAuth(call, uri("capacitor-oidc-example", null, "/callback", null));
        plugin.handleAuthResult(AuthTabIntent.RESULT_CANCELED, null);

        assertNull(call.result);
        assertFalse(call.rejected);

        plugin.handleOnResume();

        assertTrue(call.rejected);
        assertEquals("USER_CANCELLED", call.rejectionCode);
    }

    @Test
    public void ignoresCancelledFlowInAuthTabQueryResult() {
        assertCancelledFlowIgnored(false, false);
    }

    @Test
    public void ignoresCancelledFlowInFallbackQueryIntent() {
        assertCancelledFlowIgnored(true, false);
    }

    @Test
    public void ignoresCancelledFlowInAuthTabFragmentResult() {
        assertCancelledFlowIgnored(false, true);
    }

    @Test
    public void ignoresCancelledFlowInFallbackFragmentIntent() {
        assertCancelledFlowIgnored(true, true);
    }

    private static void assertCancelledFlowIgnored(boolean fallback, boolean fragment) {
        CapacitorOidcPlugin plugin = new CapacitorOidcPlugin();
        Uri expected = uri("capacitor-oidc-example", null, "/callback", null);
        RecordingCall first = new RecordingCall("flow-a", fragment);
        plugin.beginAuth(first, expected);
        plugin.handleAuthResult(AuthTabIntent.RESULT_CANCELED, null);
        plugin.handleOnResume();
        assertEquals("USER_CANCELLED", first.rejectionCode);

        RecordingCall current = new RecordingCall("flow-b", fragment);
        plugin.beginAuth(current, expected);
        if (fallback) plugin.handleAuthResult(AuthTabIntent.RESULT_CANCELED, null);
        deliver(plugin, callback("flow-a", fragment), fallback);
        plugin.handleOnResume();
        deliver(plugin, callback(null, fragment), fallback);
        assertNull(current.result);
        assertFalse(current.rejected);

        deliver(plugin, callback("flow-b", fragment), fallback);
        assertNotNull(current.result);
        assertFalse(current.rejected);
        assertNull(first.result);
    }

    @Test
    public void explicitCancelRetiresState() {
        CapacitorOidcPlugin plugin = new CapacitorOidcPlugin();
        Uri expected = uri("capacitor-oidc-example", null, "/callback", null);
        RecordingCall first = new RecordingCall("flow-a", false);
        plugin.beginAuth(first, expected);
        plugin.cancel(new RecordingCall());
        assertEquals("USER_CANCELLED", first.rejectionCode);

        RecordingCall current = new RecordingCall("flow-b", false);
        plugin.beginAuth(current, expected);
        deliver(plugin, callback("flow-a", false), false);
        assertNull(current.result);
        assertFalse(current.rejected);
        deliver(plugin, callback("flow-b", false), false);
        assertNotNull(current.result);
    }

    @Test
    public void rejectsOpaqueRedirectBeforeLaunching() {
        CapacitorOidcPlugin plugin = new CapacitorOidcPlugin();
        RecordingCall call = new RecordingCall("flow", false);
        call.getData().put("url", "https://issuer.example/authorize");
        call.getData().put("callbackUrl", "com.example.app:callback");
        Uri request = uri("https", "issuer.example", "/authorize", null);
        when(request.getHost()).thenReturn("issuer.example");
        Uri redirect = uri("com.example.app", null, null, "com.example.app:callback");
        when(redirect.isOpaque()).thenReturn(true);

        try (MockedStatic<Uri> uris = mockStatic(Uri.class)) {
            uris.when(() -> Uri.parse("https://issuer.example/authorize")).thenReturn(request);
            uris.when(() -> Uri.parse("com.example.app:callback")).thenReturn(redirect);
            plugin.open(call);
        }

        assertEquals("INVALID_CALLBACK", call.rejectionCode);
        assertNull(call.result);
    }

    @Test
    public void ignoresOpaqueAuthTabCallbackWithoutClearingCurrentFlow() {
        CapacitorOidcPlugin plugin = new CapacitorOidcPlugin();
        RecordingCall current = new RecordingCall("flow-b", false);
        plugin.beginAuth(current, uri("capacitor-oidc-example", null, "/callback", null));
        Uri opaque = uri("capacitor-oidc-example", null, null, "capacitor-oidc-example:callback?state=flow-a");
        when(opaque.isOpaque()).thenReturn(true);
        when(opaque.getQueryParameter("state")).thenThrow(new UnsupportedOperationException());

        deliver(plugin, opaque, false);
        assertNull(current.result);
        assertFalse(current.rejected);
        deliver(plugin, callback("flow-b", false), false);
        assertNotNull(current.result);
    }

    @Test
    public void acceptsOrdinaryCallbackWithUrlState() {
        CapacitorOidcPlugin plugin = new CapacitorOidcPlugin();
        RecordingCall call = new RecordingCall("flow", false);
        plugin.beginAuth(call, uri("capacitor-oidc-example", null, "/callback", null));
        deliver(plugin, callback("flow;custom-state", false), false);
        assertNotNull(call.result);
        assertFalse(call.rejected);
    }

    @Test
    public void acceptsSignoutWithOrWithoutStateThroughBothPaths() {
        for (boolean fallback : new boolean[] { false, true }) {
            for (String state : new String[] { null, "logout-state" }) {
                CapacitorOidcPlugin plugin = new CapacitorOidcPlugin();
                RecordingCall call = new RecordingCall(state, false);
                plugin.beginAuth(call, uri("capacitor-oidc-example", null, "/callback", null));
                deliver(plugin, callback(state, false), fallback);
                assertNotNull(call.result);
                assertFalse(call.rejected);
            }
        }
    }

    private static void deliver(CapacitorOidcPlugin plugin, Uri callback, boolean fallback) {
        if (fallback) {
            Intent intent = mock(Intent.class);
            when(intent.getData()).thenReturn(callback);
            plugin.handleOnNewIntent(intent);
        } else {
            plugin.handleAuthResult(AuthTabIntent.RESULT_OK, callback);
        }
    }

    private static Uri callback(String state, boolean fragment) {
        String params = "code=code" + (state == null ? "" : "&state=" + state);
        Uri callback = uri("capacitor-oidc-example", null, "/callback",
            "capacitor-oidc-example:/callback" + (fragment ? "#" : "?") + params);
        if (fragment) {
            Uri.Builder builder = mock(Uri.Builder.class);
            Uri fragmentParams = mock(Uri.class);
            when(callback.getEncodedFragment()).thenReturn(params);
            when(callback.buildUpon()).thenReturn(builder);
            when(builder.encodedQuery(params)).thenReturn(builder);
            when(builder.fragment(null)).thenReturn(builder);
            when(builder.build()).thenReturn(fragmentParams);
            when(fragmentParams.getQueryParameter("state")).thenReturn(state);
            // The query must not supply the state for a fragment response.
            when(callback.getQueryParameter("state")).thenReturn("wrong-query-state");
        } else {
            when(callback.getQueryParameter("state")).thenReturn(state);
        }
        return callback;
    }

    private static Uri uri(String scheme, String authority, String path, String value) {
        Uri uri = mock(Uri.class);
        when(uri.getScheme()).thenReturn(scheme);
        when(uri.getEncodedAuthority()).thenReturn(authority);
        when(uri.getEncodedPath()).thenReturn(path);
        when(uri.toString()).thenReturn(value);
        return uri;
    }

    private static final class RecordingCall extends PluginCall {

        private JSObject result;
        private boolean rejected;
        private String rejectionCode;

        private RecordingCall() {
            super(null, "CapacitorOidc", "callback", "open", new JSObject());
        }

        private RecordingCall(String state, boolean fragment) {
            super(null, "CapacitorOidc", "callback", "open",
                new JSObject().put("state", state).put("responseMode", fragment ? "fragment" : "query"));
        }

        @Override
        public void resolve() {}

        @Override
        public void resolve(JSObject result) {
            this.result = result;
        }

        @Override
        public void reject(String message, String code) {
            rejected = true;
            rejectionCode = code;
        }
    }
}
