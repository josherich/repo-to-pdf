const { spawnSync, spawn } = require('child_process');

module.exports = function pdf(templatePath, outputPath, options = {}) {
  const { outline = true } = options;
  const args = [
    '--disable-javascript',
    '--enable-local-file-access',
    '--default-header',
    '--margin-top', '0',
    '--margin-bottom', '0',
    '--allow', './html5bp',
  ];

  if (outline) {
    args.push('--outline');
  }

  args.push(templatePath, outputPath);

  const res = spawnSync('wkhtmltopdf', args);
  if (res.error) {
    console.log('fail to generate pdf using wkhtmltopdf', res.error);
    throw new Error(res.error);
  }
};