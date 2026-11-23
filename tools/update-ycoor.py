#!/usr/bin/env python3
"""Update Ycoor evidence, facade inventory and P0.6.7; --check never writes."""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate all generated files without writing')
    parser.add_argument('--node', help='Node.js executable path (default: node on PATH)')
    args = parser.parse_args()
    node = shutil.which(args.node or 'node')
    if node is None:
        print('Cannot update Ycoor: Node.js was not found. Install Node.js or pass --node PATH.', file=sys.stderr)
        return 1
    suffix = ['--check'] if args.check else []
    stages = [
        [sys.executable, str(ROOT / 'tools/build-b007-reconstruction.py'), *suffix],
        [sys.executable, str(ROOT / 'tools/package-streetview-supplements.py'), *suffix],
        [sys.executable, str(ROOT / 'tools/build-design-evidence.py'), *suffix],
        [node, str(ROOT / 'tools/build-facade-inventory.mjs'), *suffix],
        [sys.executable, str(ROOT / 'tools/build-p067.py'), *suffix],
    ]
    for command in stages:
        result = subprocess.run(command, cwd=ROOT)
        if result.returncode:
            print(f'Ycoor update stopped at {Path(command[1]).name}.', file=sys.stderr)
            return result.returncode
    print('Ycoor generated files are current.' if args.check else 'Updated Ycoor evidence, inventory and P0.6.7.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except OSError as error:
        print(f'Cannot update Ycoor: {error}', file=sys.stderr)
        sys.exit(1)
