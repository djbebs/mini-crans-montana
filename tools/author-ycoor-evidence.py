#!/usr/bin/env python3
"""Compatibility entry point; edit design/facades JSON and use update-ycoor.py."""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('build-design-evidence.py')), run_name='__main__')
