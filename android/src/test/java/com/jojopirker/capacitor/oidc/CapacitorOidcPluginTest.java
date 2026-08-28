package com.jojopirker.capacitor.oidc;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import android.content.Intent;
import android.net.Uri;
import androidx.browser.auth.AuthTabIntent;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.Test;

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
