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

var getConfig = function(absSrcPath) {
  var configPath = path.join(absSrcPath, 'assets.json');

  if (fs.existsSync(configPath)) {
    return require(configPath);
  } else {
    console.error('ERROR: The source directory "' + srcPath + '" does not appear to contain assets.json.');
    process.exit(1);
  }
};

var generate = function(srcPath) {
  srcPath = srcPath || '.';
  // srcPath = path.resolve(process.cwd(), srcPath);

  var absSrcPath = path.resolve(process.cwd(), srcPath);

  var buildPath = process.cwd(),
      assetConfig = getConfig(absSrcPath);

  // Setup rule for building file list file
  var compareEchoPath = path.join(__dirname, 'compare_echo.js'),
      command = 'node ' + compareEchoPath + ' "$glob" $out ' + srcPath;
  ninja.rule('COMPARE_ECHO')
    .restat(true)
    .description('Updating file list...')
    .run(command);

  // Setup rule for generating build.ninja
  ninja.rule('GENERATE')
    .generator(true)
    .description('Re-running assetman...')
    .run('assetman.cmd ' + srcPath);

  ninja.rule('CLEAN')
    .run('ninja -t clean')
    .description('Cleaning built files...');


  // Generate rules from assets.json
  for (var rule in assetConfig.rules) {
    ninja.rule(rule).run(assetConfig.rules[rule]);
  }

  var outputs = [];
  for (var pattern in assetConfig.edges) {

    // find files that match each pattern
    var files = glob.sync(pattern, {cwd: srcPath});

    // create build edge for each file found
    files.forEach(function(file) {

      // use path.join to convert path seperator to OS specific
      file = path.join(file);

      var inputPath = path.join(srcPath, file),
          ext = path.extname(file),
          noExt = file.replace(new RegExp(ext + '$'), '');

      // Create edge from each output postfix
      var outputRules = assetConfig.edges[pattern];
      for (var postfix in outputRules) {
        var rule = outputRules[postfix];
        var outputPath = noExt + postfix;

        ninja.edge(outputPath).from(inputPath).using(rule);

        // collect outputs
        outputs.push(outputPath);
      }
    });
  }

  // Setup edge for building file list
  var globs = Object.keys(assetConfig.edges).join(' ');
  ninja.edge('.dirty');
  ninja.edge('.files').from('.dirty').using('COMPARE_ECHO').assign('glob', globs);

  // Setup edge for building build.ninja
  var assetConfigPath = path.join(srcPath, 'assets.json');
  ninja.edge('build.ninja').from(['.files', assetConfigPath]).using('GENERATE');

  ninja.edge('clean').using('CLEAN');

  // Setup defaults
  ninja.byDefault(outputs.join(' '));

  ninja.save('build.ninja');
};

var commandSettings = {
  action: generate
};

var argv = process.argv.slice(2);
checkHelp(argv);
parse(commandSettings, argv);
