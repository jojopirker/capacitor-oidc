package io.github.jojopirker.capacitoroidcexample;

import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import com.jojopirker.capacitor.oidc.StoredSessionV1;
import com.jojopirker.capacitor.oidc.TokenVault;
import java.io.IOException;
import java.security.GeneralSecurityException;
import org.json.JSONException;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class AuthenticationFlowTest {

    private static final long TIMEOUT_MILLISECONDS = 30_000;
    private UiDevice device;
    private TokenVault vault;

    @Before
    public void launchApp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        assertNotNull(intent);
        vault = new TokenVault(context);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK);
        context.startActivity(intent);
    }

    @Test
    public void loginRefreshAndLogout() throws GeneralSecurityException, IOException, JSONException {
        findText("Sign in with Keycloak").click();
        completeChromeFirstRunIfNeeded();

        findResource("username").setText("demo");
        findResource("password").setText("demo");
        findResource("kc-login").click();

        findText("Hello, demo");
        StoredSessionV1 signedInSession = waitForSession();
        assertNotNull(signedInSession.getRefreshToken());
        findText("Renew session").click();
        waitForRefreshTokenChange(signedInSession.getRefreshToken());

        findText("Sign out").click();
        findText("Signed out");
        waitForSessionRemoval();
    }

    private void completeChromeFirstRunIfNeeded() {
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MILLISECONDS;
        while (!device.hasObject(By.res("username")) && SystemClock.uptimeMillis() < deadline) {
            clickIfPresent("Use without an account");
            clickIfPresent("Accept & continue");
            clickIfPresent("No thanks");
            SystemClock.sleep(100);
        }
    }

    private void clickIfPresent(String text) {
        UiObject2 object = device.findObject(By.text(text));
        if (object != null) object.click();
    }

    private UiObject2 findText(String text) {
        return find(By.text(text));
    }

    private UiObject2 findResource(String resource) {
        return find(By.res(resource));
    }

    private void waitForRefreshTokenChange(String refreshToken) throws GeneralSecurityException, IOException, JSONException {
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MILLISECONDS;
        StoredSessionV1 session = vault.loadSession("example");
        while (session != null && refreshToken.equals(session.getRefreshToken()) && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(100);
            session = vault.loadSession("example");
        }
        assertNotNull(session);
        assertNotEquals(refreshToken, session.getRefreshToken());
    }

    private StoredSessionV1 waitForSession() throws GeneralSecurityException, IOException, JSONException {
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MILLISECONDS;
        StoredSessionV1 session = vault.loadSession("example");
        while (session == null && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(100);
            session = vault.loadSession("example");
        }
        assertNotNull(session);
        return session;
    }

    private void waitForSessionRemoval() throws GeneralSecurityException, IOException, JSONException {
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MILLISECONDS;
        StoredSessionV1 session = vault.loadSession("example");
        while (session != null && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(100);
            session = vault.loadSession("example");
        }
        assertNull(session);
    }

    private UiObject2 find(androidx.test.uiautomator.BySelector selector) {
        UiObject2 object = device.wait(Until.findObject(selector), TIMEOUT_MILLISECONDS);
        assertNotNull(device.getCurrentPackageName(), object);
        return object;
    }
}
