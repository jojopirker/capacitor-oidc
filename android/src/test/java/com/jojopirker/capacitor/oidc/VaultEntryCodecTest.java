package com.jojopirker.capacitor.oidc;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import java.io.IOException;
import java.util.Arrays;
import org.junit.Test;

public class VaultEntryCodecTest {

    @Test
    public void roundTripsUtf8Values() throws IOException {
        VaultEntryCodec.Entry entry = VaultEntryCodec.decode(VaultEntryCodec.encode("state-ä", "token-✓"));
        assertEquals("state-ä", entry.key);
        assertEquals("token-✓", entry.value);
    }

    @Test
    public void rejectsTruncatedValues() throws IOException {
        byte[] encoded = VaultEntryCodec.encode("key", "value");
        byte[] truncated = Arrays.copyOf(encoded, encoded.length - 1);
        assertThrows(IOException.class, () -> VaultEntryCodec.decode(truncated));
    }
}
