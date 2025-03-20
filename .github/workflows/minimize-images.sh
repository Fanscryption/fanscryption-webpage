#!/usr/bin/env bash

JPG_COMMAND="-define jpeg:extent=300kb -resize 1000x -strip -interlace Plane -quality 85% -sampling-factor 4:2:0 -colorspace sRGB"
PNG_COMMAND="-resize 1000x"
WEBP_COMMAND="-resize 1000x -define webp:method=6 -define webp:target-size=300kb -define webp:quality=85 -define webp:auto-filter=0 -define webp:auto-level=0 -define webp:preprocessing=0 -define webp:dithering=0"

for file in "$1"/*.jpg "$1"/*.jpeg "$1"/*.png "$1"/*.webp; do
  if [ -f "$file" ]; then
    width=$(identify -format "%w" "$file")

    if [[ "$width" -gt 1000 ]]; then
      echo "Processing $file"

      if [[ $file == *.jpg || $file == *.jpeg ]]; then
        magick mogrify $JPG_COMMAND "$file"
      elif [[ $file == *.png ]]; then
        magick mogrify $PNG_COMMAND "$file"
      elif [[ $file == *.webp ]]; then
        magick mogrify $WEBP_COMMAND "$file"
      fi
    fi
  fi
done