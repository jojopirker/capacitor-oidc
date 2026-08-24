package com.jojopirker.capacitor.oidc;

import org.json.JSONException;
import org.json.JSONObject;

/** Versioned session data readable by an Android widget in the host application. */
public final class StoredSessionV1 {

    public static final int VERSION = 1;

    private final String issuer;
    private final String clientId;
    private final String accessToken;
    private final String refreshToken;
    private final String idToken;
    private final String tokenType;
    private final String scope;
    private final Long expiresAt;

    public StoredSessionV1(
        String issuer,
        String clientId,
        String accessToken,
        String refreshToken,
        String idToken,
        String tokenType,
        String scope,
        Long expiresAt
    ) {
        this.issuer = issuer;
        this.clientId = clientId;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.idToken = idToken;
        this.tokenType = tokenType;
        this.scope = scope;
        this.expiresAt = expiresAt;
    }

    public static StoredSessionV1 fromJson(String value) throws JSONException {
        JSONObject json = new JSONObject(value);
        if (json.getInt("version") != VERSION) {
            throw new JSONException("Unsupported session version");
        }

        return new StoredSessionV1(
            json.getString("issuer"),
            json.getString("clientId"),
            json.getString("accessToken"),
            optionalString(json, "refreshToken"),
            optionalString(json, "idToken"),
            json.getString("tokenType"),
            optionalString(json, "scope"),
            json.has("expiresAt") ? json.getLong("expiresAt") : null
        );
    }

    public String toJson() throws JSONException {
        JSONObject json = new JSONObject();
        json.put("version", VERSION);
        json.put("issuer", issuer);
        json.put("clientId", clientId);
        json.put("accessToken", accessToken);
        putOptional(json, "refreshToken", refreshToken);
        putOptional(json, "idToken", idToken);
        json.put("tokenType", tokenType);
        putOptional(json, "scope", scope);
        if (expiresAt != null) json.put("expiresAt", expiresAt);
        return json.toString();
    }

    public String getIssuer() {
        return issuer;
    }

    public String getClientId() {
        return clientId;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public String getIdToken() {
        return idToken;
    }

    public String getTokenType() {
        return tokenType;
    }

    public String getScope() {
        return scope;
    }

    public Long getExpiresAt() {
        return expiresAt;
    }

    private static String optionalString(JSONObject json, String key) throws JSONException {
        return json.has(key) && !json.isNull(key) ? json.getString(key) : null;
    }

    private static void putOptional(JSONObject json, String key, String value) throws JSONException {
        if (value != null) json.put(key, value);
    }
}
