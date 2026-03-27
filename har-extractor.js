/**
 * HAR Extractor Web Application
 * 
 * This module integrates HarExtractCore with the web UI to provide a complete
 * interface for uploading HAR files and downloading extracted content as ZIP.
 */

class HarExtractorApp {
  constructor() {
    this.selectedFiles = [];
    this.init();
  }

  init() {
    // DOM elements
    this.elements = {
      uploadArea: document.getElementById('uploadArea'),
      harInput: document.getElementById('harInput'),
      fileList: document.getElementById('fileList'),
      optionsSection: document.getElementById('optionsSection'),
      processBtn: document.getElementById('processBtn'),
      clearBtn: document.getElementById('clearBtn'),
      includeQuery: document.getElementById('includeQuery'),
      generateQueryManifest: document.getElementById('generateQueryManifest'),
      statsSection: document.getElementById('statsSection'),
      message: document.getElementById('message'),
      extractedCount: document.getElementById('extractedCount'),
      skippedCount: document.getElementById('skippedCount'),
      failedCount: document.getElementById('failedCount'),
      totalCount: document.getElementById('totalCount'),
      progressFill: document.getElementById('progressFill'),
      progressText: document.getElementById('progressText'),
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Upload area click
    this.elements.uploadArea.addEventListener('click', () => {
      this.elements.harInput.click();
    });

    // File input change
    this.elements.harInput.addEventListener('change', (e) => {
      this.handleFileSelect(Array.from(e.target.files));
    });

    // Drag and drop
    this.elements.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.elements.uploadArea.classList.add('dragover');
    });

    this.elements.uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.elements.uploadArea.classList.remove('dragover');
    });

    this.elements.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.elements.uploadArea.classList.remove('dragover');
      
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.har'));
      if (files.length === 0) {
        this.showMessage('Please drop HAR files only', 'error');
        return;
      }
      this.handleFileSelect(files);
    });

    // Process button
    this.elements.processBtn.addEventListener('click', () => this.processFiles());

    // Clear button
    this.elements.clearBtn.addEventListener('click', () => this.clear());
  }

  /**
   * Handle selected HAR files
   */
  handleFileSelect(files) {
    const harFiles = files.filter(f => f.name.endsWith('.har'));
    
    if (harFiles.length === 0) {
      this.showMessage('No HAR files selected. Please select .har files.', 'error');
      return;
    }

    this.selectedFiles = harFiles;
    this.updateFileList();
    this.elements.optionsSection.style.display = 'block';
    this.elements.processBtn.disabled = false;
  }

  /**
   * Update the display of selected files
   */
  updateFileList() {
    this.elements.fileList.innerHTML = '';
    
    if (this.selectedFiles.length === 0) {
      this.elements.optionsSection.style.display = 'none';
      this.elements.processBtn.disabled = true;
      return;
    }

    this.selectedFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <span class="file-item-name">📄 ${file.name} (${this.formatFileSize(file.size)})</span>
        <button class="file-item-remove" data-index="${index}">Remove</button>
      `;

      fileItem.querySelector('.file-item-remove').addEventListener('click', () => {
        this.selectedFiles.splice(index, 1);
        this.updateFileList();
      });

      this.elements.fileList.appendChild(fileItem);
    });
  }

  /**
   * Format file size in human-readable format
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Process all selected HAR files
   */
  async processFiles() {
    if (this.selectedFiles.length === 0) {
      this.showMessage('No files selected', 'error');
      return;
    }

    this.elements.processBtn.disabled = true;
    this.elements.clearBtn.disabled = true;
    this.elements.statsSection.classList.add('show');
    this.showMessage('Processing HAR files...', 'info');

    try {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip not loaded. Please ensure jszip.min.js is included.');
      }

      if (typeof HarExtractCore === 'undefined') {
        throw new Error('HarExtractCore not loaded. Please ensure core/har-extract-core.js is included.');
      }

      const masterZip = new JSZip();
      let totalExtracted = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      let totalFiles = 0;

      // Process each HAR file
      for (let fileIndex = 0; fileIndex < this.selectedFiles.length; fileIndex++) {
        const file = this.selectedFiles[fileIndex];
        const harData = await this.readHarFile(file);
        
        if (!harData) {
          totalFailed++;
          continue;
        }

        // Extract content from HAR
        const { files, stats, queryManifest, processingLog } = await HarExtractCore.extractFilesFromHar(harData, {
          includeQuerySuffix: this.elements.includeQuery.checked,
          generateQueryManifest: this.elements.generateQueryManifest.checked,
          harName: this.getHarNameFromFile(file),
          onProgress: (progress) => {
            this.updateProgress(fileIndex, this.selectedFiles.length, progress);
          }
        });

        // Add files to ZIP
        const harName = this.getHarNameFromFile(file);
        const harFolder = masterZip.folder(harName);
        
        for (const [filePath, content] of files) {
          harFolder.file(filePath, content);
          totalFiles++;
        }
        // Include query manifest if generated
        if (queryManifest) {
          harFolder.file('_query-manifest.json', JSON.stringify(queryManifest, null, 2));
        }
        // Include processing log
        harFolder.file('_processing-log.json', JSON.stringify(processingLog, null, 2));
        totalExtracted += stats.extracted;
        totalSkipped += stats.skipped;
        totalFailed += stats.failed;
      }

      // Update stats display
      this.elements.extractedCount.textContent = totalExtracted;
      this.elements.skippedCount.textContent = totalSkipped;
      this.elements.failedCount.textContent = totalFailed;
      this.elements.totalCount.textContent = totalFiles;

      // Generate ZIP file
      const timestamp = new Date().toISOString().slice(0, 10);
      const zipFileName = `har-extract-${timestamp}.zip`;

      if (totalFiles === 0) {
        this.showMessage('No content to export. All entries were skipped or failed.', 'error');
      } else {
        masterZip.generateAsync({ type: 'blob' }).then((blob) => {
          this.downloadBlob(blob, zipFileName);
          this.showMessage(
            `✓ Successfully downloaded ${totalFiles} files in ${zipFileName}`,
            'success'
          );
        });
      }

      this.elements.progressFill.style.width = '100%';
      this.elements.progressText.textContent = '100%';

    } catch (error) {
      console.error('Processing error:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    } finally {
      this.elements.processBtn.disabled = false;
      this.elements.clearBtn.disabled = false;
    }
  }

  /**
   * Read and parse a HAR file
   */
  readHarFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const harData = JSON.parse(e.target.result);
          resolve(harData);
        } catch (error) {
          this.showMessage(`Invalid HAR file: ${file.name}`, 'error');
          resolve(null);
        }
      };

      reader.onerror = () => {
        this.showMessage(`Failed to read file: ${file.name}`, 'error');
        resolve(null);
      };

      reader.readAsText(file);
    });
  }

  /**
   * Extract HAR name from filename
   */
  getHarNameFromFile(file) {
    return file.name.replace(/\.har$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Update progress display
   */
  updateProgress(fileIndex, totalFiles, progress) {
    if (progress) {
      const overallProgress = ((fileIndex + progress.current / progress.total) / totalFiles) * 100;
      this.elements.progressFill.style.width = `${Math.min(overallProgress, 99)}%`;
      this.elements.progressText.textContent = `${Math.floor(overallProgress)}%`;
    }
  }

  /**
   * Show notification message
   */
  showMessage(text, type = 'info') {
    const messageEl = this.elements.message;
    messageEl.textContent = text;
    messageEl.className = `message show ${type}`;

    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        messageEl.classList.remove('show');
      }, 5000);
    }
  }

  /**
   * Trigger a browser download for a Blob without external dependencies.
   */
  downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all selections and reset UI
   */
  clear() {
    this.selectedFiles = [];
    this.elements.harInput.value = '';
    this.elements.fileList.innerHTML = '';
    this.elements.optionsSection.style.display = 'none';
    this.elements.statsSection.classList.remove('show');
    this.elements.processBtn.disabled = true;
    this.elements.message.classList.remove('show');
    this.resetStats();
  }

  /**
   * Reset statistics display
   */
  resetStats() {
    this.elements.extractedCount.textContent = '0';
    this.elements.skippedCount.textContent = '0';
    this.elements.failedCount.textContent = '0';
    this.elements.totalCount.textContent = '0';
    this.elements.progressFill.style.width = '0%';
    this.elements.progressText.textContent = '0%';
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new HarExtractorApp();
  });
} else {
  window.app = new HarExtractorApp();
}
