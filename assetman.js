#!/usr/bin/env node

/*
 * assetman
 * https://github.com/miningold/assetman
 *
 * Copyright (c) 2013 Tylor Reynolds
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path'),
    fs = require('fs'),
    util = require('util'),
    exec = require('child_process').exec,
    minimatch = require('minimatch'),
    glob = require('glob'),
    ninja = require('ninja-build-gen')(),
    checkHelp,
    showHelp,
    help,
    parse;

// check argv for -h or --help
checkHelp = function(argv) {
  var len = argv.length,
      arg,
      i;

  for (i = 0; i < len; i++) {
    arg = argv[i];

    if ('-h' == arg || '--help' == arg) {
      help();
    }
  }
};

// Show usage for this command
showHelp = function() {
  console.log();
  console.log('  Usage: assetman [options] <command>');
  console.log();
  console.log('  Commands:');
  console.log();
  console.log('    all [filter]     Convert all assets, optional filter.');
  console.log('    recent [filter]  Convert recently modified assets, optional filter.');
  console.log();
  console.log('  Options:');
  console.log();
  console.log('    -h, --help  Show usage information');
  console.log();
};

// Show help message, exit 0
help = function() {
  showHelp();
  process.exit();
};

// Parse agv for arguments, recurse for sub-commands
parse = function(settings, argv) {
  var commands = settings.commands,
      len = argv.length,
      arg, i;

  // parse first command found, ignore the rest
  if (commands) {
    for (i = 0; i < len; i++) {
      arg = argv[i];

      if (commands[arg]) {

        // pass arguments to sub-command
        argv.splice(i, 1);
        return parse(commands[arg], argv);
      }
    }
  }

  // If a command was not found and an action exist, call it.
  if (settings.action) {
    settings.action.apply(this, argv);
  } else {
    // No action for this command, this is an error, show help
    showHelp();
    process.exit(1);
  }
};

var getConfig = function(srcPath) {
  var configPath = path.join(srcPath, 'assets.json');

  if (fs.existsSync(configPath)) {
    return require(configPath);
  } else {
    console.error('ERROR: The source directory "' + srcPath + '" does not appear to contain assets.json.');
    process.exit(1);
  }
};

var generate = function(srcPath) {
  srcPath = srcPath || '';
  srcPath = path.resolve(process.cwd(), srcPath);

  var buildPath = process.cwd(),
      assetConfig = getConfig(srcPath);

  var srcRelPath = path.relative(buildPath, srcPath);

  var compareEchoPath = path.join(__dirname, 'compare_echo.js'),
      command = 'node ' + compareEchoPath + ' "$glob" $out ' + srcRelPath;
  ninja.rule('compare_echo')
    .restat(true)
    .description('Update file list')
    .run(command);

  ninja.rule('rebuild')
    .generator(true)
    .description('Generate build.ninja')
    .run('assetman.cmd ' + srcRelPath);

  for (var rule in assetConfig.rules) {
    ninja.rule(rule).run(assetConfig.rules[rule]);
  }

  var patterns = [];
  var assets = [];
  for (var pattern in assetConfig.files) {
    patterns.push(pattern);
    var files = glob.sync(pattern, {cwd: srcPath});

    var len = files.length, i;
    for (i = 0; i < len; ++i) {
      var target = path.relative(buildPath, path.join(srcPath, files[i]));
      var inRelPath = files[i];
      var relDir = path.dirname(inRelPath);

      var filename = path.basename(inRelPath, path.extname(inRelPath));

      var outPatterns = assetConfig.files[pattern];
      for (var outPattern in outPatterns) {
        var rule = outPatterns[outPattern];
        var outName = outPattern.replace(/\$filename/, filename);
        var outRelPath = path.join(relDir, outName);

        ninja.edge(outRelPath).from(target).using(rule);
        assets.push(outRelPath);
      }
    }
  }

  var globs = patterns.join(' ');
  ninja.edge('.dirty');
  ninja.edge('.files').from('.dirty').using('compare_echo').assign('glob', globs);

  var assetConfigPath = path.join(srcRelPath, 'assets.json');
  ninja.edge('build.ninja').from(['.files', assetConfigPath]).using('rebuild');

  ninja.edge('assets').from(assets);
  ninja.byDefault('assets');

  ninja.save('build.ninja');
};

var commandSettings = {
  action: generate
};

var argv = process.argv.slice(2);
checkHelp(argv);
parse(commandSettings, argv);
