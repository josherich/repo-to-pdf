const { spawnSync, spawn } = require('child_process');

module.exports = function pdf(templatePath, outputPath) {
  const res = spawnSync('wkhtmltopdf', [
    '--disable-javascript',
    '--default-header',
    '--margin-top', '0',
    '--margin-bottom', '0',
    '--allow', './html5bp',
    templatePath,
    outputPath
  ]);
  if (res.error) {
    console.log('fail to generate pdf using wkhtmltopdf', res.error);
    throw new Error(res.error);
  }
};