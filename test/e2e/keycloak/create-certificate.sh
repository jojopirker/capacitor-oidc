#!/bin/sh
set -eu

certificate_dir=$1
script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)

mkdir -p "$certificate_dir"
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 7 \
  -config "$script_dir/certificate.conf" \
  -keyout "$certificate_dir/ca.key" \
  -out "$certificate_dir/ca.crt" \
  >/dev/null 2>&1
openssl req -new -newkey rsa:2048 -nodes -sha256 \
  -subj "/CN=localhost" \
  -keyout "$certificate_dir/server.key" \
  -out "$certificate_dir/server.csr" \
  >/dev/null 2>&1
openssl x509 -req -sha256 -days 7 \
  -in "$certificate_dir/server.csr" \
  -CA "$certificate_dir/ca.crt" \
  -CAkey "$certificate_dir/ca.key" \
  -CAcreateserial \
  -extfile "$script_dir/server.ext" \
  -out "$certificate_dir/server.crt" \
  >/dev/null 2>&1
chmod 0644 "$certificate_dir/server.key"
