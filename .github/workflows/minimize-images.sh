#!/usr/bin/env bash

set -euo pipefail

for img in *.jpg; do
  echo "optimizing $img"

  # works on both macOS and Linux
  size=$( (stat -f%z "$img" 2>/dev/null || stat -c%s "$img" 2>/dev/null) | tr -d '[:space:]')

  # image less than ~300KB, no need to optimize
  if [ "$size" -le 320000 ]; then
    continue
  fi

  magick mogrify -resize '1000x>' -strip \
    -define jpeg:extent=300KB -sampling-factor 4:2:0 \
    "$img"
done

for img in *.webp; do
  echo "optimizing $img"

  # works on both macOS and Linux
  size=$( (stat -f%z "$img" 2>/dev/null || stat -c%s "$img" 2>/dev/null) | tr -d '[:space:]')

  # image less than 300KB, no need to optimize
  if [ "$size" -le 307200 ]; then
    continue
  fi

  magick mogrify -resize '1000x>' -strip \
    -define webp:lossless=false -quality 80 \
    -define webp:target-size=300000 \
    "$img"
done

for img in *.png; do
  echo "optimizing $img"

  # works on both macOS and Linux
  size=$( (stat -f%z "$img" 2>/dev/null || stat -c%s "$img" 2>/dev/null) | tr -d '[:space:]')

  # image less than 300KB, no need to optimize
  if [ "$size" -le 307200 ]; then
    continue
  fi

  magick mogrify -resize '1000x>' -strip -colors 256 \
    -define png:compression-level=9 \
    -define png:compression-filter=5 \
    -define png:compression-strategy=1 \
    "$img"
done
