# Chrome Extension Zipper

Automatically zip your Chrome extensions with customized manifest files.

## Features

- Create multiple builds with different manifest configurations
- Automatic version-based naming
- Smart file exclusions
- Progress indicators

## Usage

1. Create a `zips.json` file in your Chrome extension root
2. Run "Zip Chrome Extension" command
3. Find your builds in the `builds/` folder

## Configuration

Example `zips.json`:
```json
{
  "dev": {
    "name": "My Extension (Dev)",
    "version": "1.0.0-dev"
  },
  "production": {
    "name": "My Extension"
  }
}"# vscode.extension.zipper.plugin" 
