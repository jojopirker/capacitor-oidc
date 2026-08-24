package com.jojopirker.capacitor.oidc;

import android.net.Uri;

final class CallbackUriMatcher {

    private CallbackUriMatcher() {}

    static boolean matches(Uri actual, Uri expected) {
        return equalIgnoringCase(actual.getScheme(), expected.getScheme()) &&
        equalIgnoringCase(actual.getEncodedAuthority(), expected.getEncodedAuthority()) &&
        equal(actual.getEncodedPath(), expected.getEncodedPath());
    }

    private static boolean equal(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    private static boolean equalIgnoringCase(String left, String right) {
        return left == null ? right == null : left.equalsIgnoreCase(right);
    }
}
