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
    find = require('findit'),
    mkdirp = require('mkdirp'),
    checkHelp,
    showHelp,
    help,
    parse;

var cDir = process.cwd(),
    pDir, assetConfig,
    configPath;

// Search for Asset Config file starting with working directory and working
// up the hierarchy
while (cDir != pDir) {
  configPath = path.join(cDir, 'assets.json');
  if (fs.existsSync(configPath)) {
    assetConfig = require(configPath);

    // resolve paths
    assetConfig.boar_repo = path.resolve(cDir, assetConfig.boar_repo);
    assetConfig.target_dir = path.resolve(cDir, assetConfig.target_dir);
    break;
  }

  pDir = cDir;
  cDir = path.join(cDir, '..');
}

if (!assetConfig) {
  console.error('Could not find assets.json file');
  process.exit(1);
}

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

var convert,
    convertAll,
    convertRecent,
    getConverter;

convert = function(input, converter) {
  var output,
      indir, outdir,
      absInput, absOutput,
      re, i, ext;

  ext = path.extname(input);

  re = new RegExp(ext + '$', 'i');

  // replace extension
  output = input.replace(re, converter.ext);

  indir = assetConfig.boar_repo;
  outdir = assetConfig.target_dir;

  absInput = path.join(indir, input);
  absOutput = path.join(outdir, output);

  // make directories if they don't exist
  mkdirp(path.dirname(absOutput), function(err) {
    if (err) {
      throw err;
    }

    // Populate convert command
    var command = converter.command.replace('%i', absInput).replace('%o', absOutput);
    exec(command,
      function(error, stdout, stderr) {
        if (error) {
          throw error;
        }

        console.log('Produced: ' + absOutput);
    });
  });
};

// Get converter from asset config and check input file against filters
getConverter = function(input, filters) {
  var ext = path.extname(input),
      filterMap = assetConfig.filters,
      extensions = [],
      filterExts,
      filter,
      len, i;

  // Get list of file extensions from filters specified in asset config
  len = filters.length;
  for (i = 0; i < len; i++) {
    filter = filters[i];
    filterExts = filterMap[filter];

    // Is this filter spec in asset config?
    if (filterExts) {
      extensions = extensions.concat(filterExts);
    } else {
      // invalid filter
      console.error('Filter "' + filter + '" does not exist.');
      process.exit(1);
    }
  }

  // There are no filters, or file passes filters
  if (!extensions.length || ~extensions.indexOf(ext)) {
    return assetConfig.converters[ext];
  }
};

convertAll = function() {
  var indir = assetConfig.boar_repo,
      filters = arguments,
      finder;

  // walk file directory, trying to convert all files found
  finder = find(indir);
  finder.on('file', function(file, stat) {
    var input = path.relative(indir, file),
        converter = getConverter(input, filters);

    if (converter) {
      convert(input, converter);
    }
  });
};

convertRecent = function() {
  var infoPath = path.join(assetConfig.boar_repo, '.boar/info'),
      boarInfo = JSON.parse(fs.readFileSync(infoPath)),
      revision = boarInfo.session_id,
      repoPath = boarInfo.repo_path,
      filters = arguments,
      command;

  command = util.format('boar --repo=%s log -vr %d', repoPath, revision);

  // run boar log
  exec(command,
    function(error, stdout, stderr) {
      if (error) {
        console.error(error);
      }

      // Scan for new or modified files
      // A new-file or M modifiedFile
      var matches = stdout.match(/^[AM]\s*(.+)/m),
          len = matches.length,
          converter, i,
          match;

      for (i = 1; i < len; i++) {
        match = matches[i];
        converter = getConverter(match, filters);

        if (converter) {
          convert(match, converter);
        }
      }
  });
};

var commandSettings = {
  commands: {
    all: {
      action: convertAll
    },
    recent: {
      action: convertRecent
    }
  }
};

var argv = process.argv.slice(2);
checkHelp(argv);
parse(commandSettings, argv);
