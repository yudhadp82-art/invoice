// Debug logger untuk PurchaseNoteForm
class DebugLogger {
  constructor(componentName = 'PurchaseNoteForm') {
    this.componentName = componentName;
    this.logs = [];
    this.startTime = Date.now();
  }

  log(category, action, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      component: this.componentName,
      category,
      action,
      data,
      elapsed: Date.now() - this.startTime
    };

    this.logs.push(logEntry);

    // Also write to browser console
    if (typeof window !== 'undefined') {
      console.log(`[${this.componentName}] [${timestamp}] ${category.toUpperCase()}: ${action}`, data);
    }

    // Write to file as backup
    this.writeToFile();
  }

  writeToFile() {
    try {
      const fs = require('fs');
      const logsContent = this.logs.map(log =>
        `[${log.timestamp}] [${log.componentName}] [${log.category.toUpperCase()}] ${log.action}: ${JSON.stringify(log.data, null, 2)}`
      ).join('\n');

      fs.writeFileSync(
        `d:\\invoice\\invoice\\logs\\debug_${this.componentName}_${new Date().toISOString().split('T')[0]}.txt`,
        logsContent,
        'utf8'
      );
    } catch (error) {
      console.error('[DebugLogger] Failed to write to file:', error);
    }
  }

  getLogs() {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.startTime = Date.now();
    this.writeToFile();
  }
}

export default DebugLogger;