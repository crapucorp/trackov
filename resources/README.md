# Resources (Bundled)

This directory contains bundled resources that are included with the packaged application.

## python-embed/

Portable Python 3.11.9 distribution with all dependencies pre-installed for the scanner feature.

**DO NOT COMMIT** - This directory should be git-ignored and is only used for local builds and CI/CD.

### Contents:
- Python 3.11.9 Embeddable (Windows x64)
- pip + setuptools
- All dependencies from `vision/requirements.txt`:
  - opencv-python
  - numpy
  - fastapi
  - uvicorn
  - pytesseract
  - and more...

### Size: ~100MB

This allows the scanner feature to work immediately after installation without requiring users to install Python separately.
