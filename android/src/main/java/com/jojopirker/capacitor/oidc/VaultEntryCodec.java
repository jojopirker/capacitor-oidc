package com.jojopirker.capacitor.oidc;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

final class VaultEntryCodec {

    private VaultEntryCodec() {}

    static byte[] encode(String key, String value) throws IOException {
        byte[] keyBytes = key.getBytes(StandardCharsets.UTF_8);
        byte[] valueBytes = value.getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream(keyBytes.length + valueBytes.length + 8);
        DataOutputStream output = new DataOutputStream(bytes);
        output.writeInt(keyBytes.length);
        output.write(keyBytes);
        output.writeInt(valueBytes.length);
        output.write(valueBytes);
        return bytes.toByteArray();
    }

    static Entry decode(byte[] bytes) throws IOException {
        DataInputStream input = new DataInputStream(new ByteArrayInputStream(bytes));
        int keyLength = input.readInt();
        if (keyLength < 0 || keyLength > input.available() - 4) {
            throw new IOException("Invalid vault entry");
        }

        byte[] keyBytes = new byte[keyLength];
        input.readFully(keyBytes);

        int valueLength = input.readInt();
        if (valueLength < 0 || valueLength != input.available()) {
            throw new IOException("Invalid vault entry");
        }

        byte[] valueBytes = new byte[valueLength];
        input.readFully(valueBytes);
        return new Entry(new String(keyBytes, StandardCharsets.UTF_8), new String(valueBytes, StandardCharsets.UTF_8));
    }

    static final class Entry {

        final String key;
        final String value;

        Entry(String key, String value) {
            this.key = key;
            this.value = value;
        }
    }
}

