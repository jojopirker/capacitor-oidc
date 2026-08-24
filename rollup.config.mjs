export default {
  input: 'dist/esm/index.js',
  output: {
    file: 'dist/plugin.cjs',
    format: 'cjs',
    sourcemap: true,
  },
  external: ['@capacitor/app', '@capacitor/core', 'oidc-client-ts'],
};
