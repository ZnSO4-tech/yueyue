#!/usr/bin/env python3
import argparse
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+")
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    engine = RapidOCR()

    for image_name in args.images:
        image_path = Path(image_name)
        result, _elapsed = engine(str(image_path))
        lines = []
        if result:
            for box, text, confidence in result:
                y = min(point[1] for point in box)
                x = min(point[0] for point in box)
                lines.append((y, x, confidence, text))
        lines.sort(key=lambda item: (round(item[0] / 8), item[1]))
        output = "\n".join(text for _, _, _, text in lines)
        target = output_dir / f"{image_path.stem}.txt"
        target.write_text(output, encoding="utf-8")
        print(f"{image_path.name}\t{len(lines)} lines", flush=True)


if __name__ == "__main__":
    main()
