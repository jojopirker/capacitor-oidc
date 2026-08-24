package com.jojopirker.capacitor.oidc;

import static org.junit.Assert.assertEquals;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;
import org.junit.Test;

public class StoredSessionV1Test {

    @Test
    public void decodesSharedFixture() throws Exception {
        String fixture = new Scanner(
            new File(System.getProperty("storedSessionFixture")),
            StandardCharsets.UTF_8.name()
        )
            .useDelimiter("\\A")
            .next();
        StoredSessionV1 session = StoredSessionV1.fromJson(fixture);

        assertEquals("https://issuer.example", session.getIssuer());
        assertEquals("mobile", session.getClientId());
        assertEquals("access", session.getAccessToken());
        assertEquals("refresh", session.getRefreshToken());
        assertEquals("id-token", session.getIdToken());
        assertEquals("Bearer", session.getTokenType());
        assertEquals("openid profile offline_access", session.getScope());
        assertEquals(Long.valueOf(1_800_000_000), session.getExpiresAt());
    }
}
