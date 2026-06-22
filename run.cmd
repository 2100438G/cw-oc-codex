@echo off
python build.py
python -m http.server 8000 --directory _site
