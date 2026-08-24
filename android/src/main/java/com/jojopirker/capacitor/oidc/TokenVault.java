package com.jojopirker.capacitor.oidc;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONException;

/**
 * App-private token storage that can also be used directly by a widget in the host application.
 * Values are encrypted with an AES-GCM key held by Android Keystore.
 */
public final class TokenVault {

    private static final String KEY_STORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "com.jojopirker.capacitor.oidc.token-vault.v1";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int MAGIC = 0x434f4944;
    private static final int FORMAT_VERSION = 1;
    private static final String FILE_EXTENSION = ".vault";
    private static final String SNAPSHOT_KEY = "current";
    private static final String SNAPSHOT_NAMESPACE_PREFIX = "session-snapshot:";

    private final File rootDirectory;

    public TokenVault(Context context) {
        rootDirectory = new File(context.getNoBackupFilesDir(), "capacitor-oidc");
    }

    public synchronized void set(String namespace, String key, String value) throws GeneralSecurityException, IOException {
        File file = entryFile(namespace, key, true);
        byte[] plaintext = VaultEntryCodec.encode(key, value);
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        cipher.updateAAD(aad(namespace));
        byte[] ciphertext = cipher.doFinal(plaintext);
        write(file, cipher.getIV(), ciphertext);
    }

    public synchronized String get(String namespace, String key) throws GeneralSecurityException, IOException {
        File file = entryFile(namespace, key, false);
        if (!file.exists()) return null;
        VaultEntryCodec.Entry entry = decrypt(namespace, file);
        if (!entry.key.equals(key)) throw new GeneralSecurityException("Vault key mismatch");
        return entry.value;
    }

    public synchronized String remove(String namespace, String key) throws GeneralSecurityException, IOException {
        String value = get(namespace, key);
        if (value != null) new AtomicFile(entryFile(namespace, key, false)).delete();
        return value;
    }

    public synchronized List<String> getAllKeys(String namespace) throws GeneralSecurityException, IOException {
        File directory = namespaceDirectory(namespace);
        File[] files = directory.listFiles((ignored, name) -> name.endsWith(FILE_EXTENSION));
        if (files == null) return Collections.emptyList();

        Arrays.sort(files);
        List<String> keys = new ArrayList<>(files.length);
        for (File file : files) keys.add(decrypt(namespace, file).key);
        Collections.sort(keys);
        return keys;
    }

    public synchronized void setSessionSnapshot(String namespace, String value) throws GeneralSecurityException, IOException {
        String snapshotNamespace = SNAPSHOT_NAMESPACE_PREFIX + namespace;
        if (value == null) {
            remove(snapshotNamespace, SNAPSHOT_KEY);
        } else {
            set(snapshotNamespace, SNAPSHOT_KEY, value);
        }
    }

    public synchronized String getSessionSnapshot(String namespace) throws GeneralSecurityException, IOException {
        return get(SNAPSHOT_NAMESPACE_PREFIX + namespace, SNAPSHOT_KEY);
    }

    public synchronized StoredSessionV1 loadSession(String namespace) throws GeneralSecurityException, IOException, JSONException {
        String value = getSessionSnapshot(namespace);
        return value == null ? null : StoredSessionV1.fromJson(value);
    }

    private VaultEntryCodec.Entry decrypt(String namespace, File file) throws GeneralSecurityException, IOException {
        EncryptedValue encrypted = read(file);
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, encrypted.iv));
        cipher.updateAAD(aad(namespace));
        return VaultEntryCodec.decode(cipher.doFinal(encrypted.ciphertext));
    }

    private static synchronized SecretKey getOrCreateKey() throws GeneralSecurityException, IOException {
        KeyStore keyStore = KeyStore.getInstance(KEY_STORE);
        keyStore.load(null);
        SecretKey key = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (key != null) return key;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEY_STORE);
        generator.init(
            new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        );
        return generator.generateKey();
    }

    private File entryFile(String namespace, String key, boolean createDirectory) throws GeneralSecurityException, IOException {
        File directory = namespaceDirectory(namespace);
        if (createDirectory && !directory.exists() && !directory.mkdirs()) {
            throw new IOException("Unable to create vault directory");
        }
        return new File(directory, digest(key) + FILE_EXTENSION);
    }

    private File namespaceDirectory(String namespace) throws GeneralSecurityException {
        return new File(rootDirectory, digest("namespace\u0000" + namespace));
    }

    private static String digest(String value) throws GeneralSecurityException {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(hash, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private static byte[] aad(String namespace) {
        return ("capacitor-oidc-v1\u0000" + namespace).getBytes(StandardCharsets.UTF_8);
    }

    private static void write(File file, byte[] iv, byte[] ciphertext) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream(iv.length + ciphertext.length + 10);
        DataOutputStream data = new DataOutputStream(bytes);
        data.writeInt(MAGIC);
        data.writeByte(FORMAT_VERSION);
        data.writeByte(iv.length);
        data.write(iv);
        data.writeInt(ciphertext.length);
        data.write(ciphertext);

        AtomicFile atomicFile = new AtomicFile(file);
        FileOutputStream output = atomicFile.startWrite();
        try {
            output.write(bytes.toByteArray());
            atomicFile.finishWrite(output);
        } catch (IOException error) {
            atomicFile.failWrite(output);
            throw error;
        }
    }

    private static EncryptedValue read(File file) throws IOException {
        AtomicFile atomicFile = new AtomicFile(file);
        byte[] bytes;
        try (FileInputStream input = atomicFile.openRead(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            bytes = output.toByteArray();
        }

        DataInputStream data = new DataInputStream(new ByteArrayInputStream(bytes));
        if (data.readInt() != MAGIC || data.readUnsignedByte() != FORMAT_VERSION) {
            throw new IOException("Unsupported vault format");
        }

        int ivLength = data.readUnsignedByte();
        byte[] iv = new byte[ivLength];
        data.readFully(iv);
        int ciphertextLength = data.readInt();
        if (ciphertextLength < 0 || ciphertextLength != data.available()) {
            throw new IOException("Invalid vault entry");
        }
        byte[] ciphertext = new byte[ciphertextLength];
        data.readFully(ciphertext);
        return new EncryptedValue(iv, ciphertext);
    }

    private static final class EncryptedValue {

        final byte[] iv;
        final byte[] ciphertext;

        EncryptedValue(byte[] iv, byte[] ciphertext) {
            this.iv = iv;
            this.ciphertext = ciphertext;
        }
    }
}
