var glob = require('glob'),
    fs = require('fs'),
    args = process.argv.slice(2),
    cwd = args[2] || process.cwd();

// construct search patterns
var patterns = args[0].split(' '),
    pattern = patterns.length > 1 ? '{' + patterns.join(',') + '}' : patterns[0];

// collect files that match pattern
var files = glob.sync(pattern, {cwd: cwd}).join('\n');

// update file list in output if they don't match
var outpath = args[1];
fs.readFile(outpath, {encoding: 'utf8'}, function(_, oldfiles) {
  if (oldfiles !== files) {
    fs.writeFileSync(outpath, files);
  }
});
