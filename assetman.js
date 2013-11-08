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
    mkdirp = require('mkdirp'),
    minimatch = require('minimatch'),
    Glob = require("glob").Glob,
    checkHelp,
    showHelp,
    help,
    parse;

var currentDir = process.cwd(),
    previousDir, assetConfig,
    configPath;

// Search for Asset Config file starting with working directory and working
// up the hierarchy
// curr and prev will be the same when root is reached
while (currentDir != previousDir) {
  configPath = path.join(currentDir, 'assets.json');
  if (fs.existsSync(configPath)) {
    assetConfig = require(configPath);

    // resolve paths
    assetConfig.boar_repo = path.resolve(currentDir, assetConfig.boar_repo);
    assetConfig.target_dir = path.resolve(currentDir, assetConfig.target_dir);
    break;
  }

  previousDir = currentDir;
  currentDir = path.join(currentDir, '..');
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
    getConverter,
    filterConverters;

convert = function(input, converter) {
  var filename,
      indir, outdir,
      absInput, absFilename,
      re, i, ext;

  // replace extension
  // output = input.replace(re, converter.ext);
  filename = input.slice(0, input.lastIndexOf(path.extname(input)));

  indir = assetConfig.boar_repo;
  outdir = assetConfig.target_dir;

  absInput = path.join(indir, input);
  absFilename = path.join(outdir, filename);
  // make directories if they don't exist
  mkdirp(path.dirname(absFilename), function(err) {
    if (err) {
      throw err;
    }

    // var commands = con
    // If a string, turn into array: [string]
    var commands = ([]).concat(converter.commands);

    commands.forEach(function(command) {
      // Populate convert command
      command = command.replace('%i', absInput).replace('%n', absFilename);

      exec(command,
        function(error, stdout, stderr) {
          if (error) throw err;
          console.log('Processed: ' + input);
      });
    });
  });
};

// Get converter from asset config and check input file against filters
getConverter = function(file, converters) {
  var len = converters.length,
      i, converter;

  for (i = 0; i < len; ++i) {
    converter = converters[i];

    if (minimatch(file, converter.pattern)) {
      return converter;
    }
  }

  return null;
};

filterConverters = function(filters) {
  // filters may be 'arguments' which isn't a proper array
  filters = Array.prototype.slice.call(filters);

  var converters;
  if (filters.length !== 0) {
    converters = assetConfig.converters.filter(function(converter) {
      return !converter.tag || filters.indexOf(converter.tag) !== -1;
    });
  } else {
    converters = assetConfig.converters;
  }

  return converters;
};

convertAll = function() {
  var indir = assetConfig.boar_repo,
      converters = filterConverters(arguments);

  var glob, cache = null;
  converters.forEach(function(converter) {
    glob = new Glob(converter.pattern, { cache: cache, cwd: indir });
    cache = glob.cache;

    glob.on("match", function(file) {
      convert(file, converter);
    })
  });
};

convertRecent = function() {
  var infoPath = path.join(assetConfig.boar_repo, '.boar/info'),
      converters = filterConverters(arguments);

  fs.readFile(infoPath, function(err, boarJSON) {
    if (err) {
      console.error(assetConfig.boar_repo + " is not a boar repo");
      process.exit(1);
    }

    var boarInfo = JSON.parse(boarJSON),
        revision = boarInfo.session_id,
        repoPath = boarInfo.repo_path,
        boarLog = util.format('boar --repo=%s log -vr %d', repoPath, revision);

    // run boar log
    exec(boarLog, function(error, stdout, stderr) {
      if (error || stderr) {
        console.error("Error executing boar log: " + (error || stderr));
        process.exit(1);
      }

      // Scan for new or modified files
      // A new-file or M modifiedFile
      var modified = stdout.match(/^[AM]\s*(.+)/m),
          len = modified.length,
          i, file,
          converter;
    
      for (i = 1; i < len; i++) {
        file = modified[i];
        converter = getConverter(file, converters);
        if (converter) {
          convert(file, converter);
        }
      }
    });
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
