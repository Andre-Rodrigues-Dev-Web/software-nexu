const { execFile } = require("child_process");

function executePowerShell(command) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024 * 4 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ ok: false, output: "", error: stderr || error.message });
          return;
        }
        resolve({ ok: true, output: stdout, error: stderr });
      }
    );
  });
}

module.exports = {
  executePowerShell
};
