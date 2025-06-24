import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';

interface ZipsConfig {
  [key: string]: { [manifestKey: string]: any };
}

interface ChromeManifest {
  version: string;
  [key: string]: any;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Chrome Extension Zipper is now active!');

  let disposable = vscode.commands.registerCommand('chrome-extension-zipper.zipExtension', async () => {
    try {
      await zipChromeExtension();
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function zipChromeExtension() {
  // Get the current workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder in VS Code.');
    return;
  }

  const rootPath = workspaceFolder.uri.fsPath;
  const zipsJsonPath = path.join(rootPath, 'zips.json');
  const manifestPath = path.join(rootPath, 'manifest.json');

  // Check if required files exist
  if (!fs.existsSync(zipsJsonPath)) {
    vscode.window.showErrorMessage('zips.json file not found in the root directory.');
    return;
  }

  if (!fs.existsSync(manifestPath)) {
    vscode.window.showErrorMessage('manifest.json file not found in the root directory.');
    return;
  }

  // Read and parse files
  let zipsConfig: ZipsConfig;
  let originalManifest: ChromeManifest;

  try {
    const zipsContent = fs.readFileSync(zipsJsonPath, 'utf8');
    zipsConfig = JSON.parse(zipsContent);
  } catch (error) {
    vscode.window.showErrorMessage('Error parsing zips.json file.');
    return;
  }

  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    originalManifest = JSON.parse(manifestContent);
  } catch (error) {
    vscode.window.showErrorMessage('Error parsing manifest.json file.');
    return;
  }

  if (!originalManifest.version) {
    vscode.window.showErrorMessage('No version found in manifest.json.');
    return;
  }

  // Create output directory
  const outputDir = path.join(rootPath, 'builds');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Show progress
  const progress = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Zipping Chrome Extensions",
    cancellable: false
  }, async (progress) => {
    const keys = Object.keys(zipsConfig);
    let completed = 0;

    for (const zipKey of keys) {
      progress.report({ 
        increment: (1 / keys.length) * 100, 
        message: `Creating ${zipKey}...` 
      });

      const zipConfig = zipsConfig[zipKey];
      const zipName = `${zipKey}-${originalManifest.version}.zip`;
      const zipPath = path.join(outputDir, zipName);

      // Create modified manifest
      const modifiedManifest = { ...originalManifest };
      Object.assign(modifiedManifest, zipConfig);

      await createZip(rootPath, zipPath, modifiedManifest);
      completed++;
    }

    return completed;
  });

  vscode.window.showInformationMessage(`Successfully created ${progress} zip files in the builds folder.`);
}

function createZip(sourcePath: string, outputPath: string, modifiedManifest: ChromeManifest): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add all files except certain directories/files
    const excludePatterns = [
      'builds/',
      'node_modules/',
      '.git/',
      '.vscode/',
      '*.zip',
      '.gitignore',
      'package-lock.json',
      'yarn.lock'
    ];

    // Read directory contents
    const files = getAllFiles(sourcePath, excludePatterns);
    
    // Add files to archive
    files.forEach(file => {
      const relativePath = path.relative(sourcePath, file);
      
      // Special handling for manifest.json
      if (relativePath === 'manifest.json') {
        archive.append(JSON.stringify(modifiedManifest, null, 2), { name: 'manifest.json' });
      } else {
        archive.file(file, { name: relativePath });
      }
    });

    archive.finalize();
  });
}

function getAllFiles(dirPath: string, excludePatterns: string[]): string[] {
  const files: string[] = [];
  
  function scanDir(currentPath: string) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const relativePath = path.relative(dirPath, fullPath);
      
      // Check if this item should be excluded
      const shouldExclude = excludePatterns.some(pattern => {
        if (pattern.endsWith('/')) {
          return relativePath.startsWith(pattern) || relativePath + '/' === pattern;
        } else if (pattern.startsWith('*.')) {
          return item.endsWith(pattern.slice(1));
        } else {
          return relativePath === pattern || item === pattern;
        }
      });
      
      if (shouldExclude) {
        continue;
      }
      
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  scanDir(dirPath);
  return files;
}

export function deactivate() {}