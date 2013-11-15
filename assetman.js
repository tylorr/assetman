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
    glob = require('glob'),
    ninjaGen = require('ninja-build-gen'),
    _ = require('lodash'),
    srcCache = {},
    buildCache = {},
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
  console.log('  Usage: assetman [src_path]');
  console.log();
  console.log('  [src_path]  Path to source direcctory containing assets.json');
  console.log('              defaults to current directory');
  console.log();
  console.log('  -h, --help  Show usage information');
  console.log();
};

// Show help message, exit 0
help = function() {
  showHelp();
  process.exit();
};


// // Parse agv for arguments, recurse for sub-commands
// parse = function(settings, argv) {
//   var commands = settings.commands,
//       len = argv.length,
//       arg, i;

//   // parse first command found, ignore the rest
//   if (commands) {
//     for (i = 0; i < len; i++) {
//       arg = argv[i];

//       if (commands[arg]) {

//         // pass arguments to sub-command
//         argv.splice(i, 1);
//         return parse(commands[arg], argv);
//       }
//     }
//   }

//   // If a command was not found and an action exist, call it.
//   if (settings.action) {
//     settings.action.apply(this, argv);
//   } else {
//     // No action for this command, this is an error, show help
//     showHelp();
//     process.exit(1);
//   }
// };

// var getConfig = function(absSrcPath) {
//   var configPath = path.join(absSrcPath, 'assets.json');

//   if (fs.existsSync(configPath)) {
//     return require(configPath);
//   } else {
//     console.error('ERROR: The source directory "' + srcPath + '" does not appear to contain assets.json.');
//     process.exit(1);
//   }
// };

var RuleBuilder = (function() {
  function RuleBuilder(name) {
    this.name = name;
  }

  RuleBuilder.prototype.command = function(command) {
    this.command = command;
    return this;
  }

  return RuleBuilder;
})();

var SingleBuilder = (function() {
  function SingleBuilder(pattern) {
    this.pattern = pattern;
    this.buildRelative = false;
    this.assignments = {};
  }

  SingleBuilder.prototype.fromBuild = function(fromBuild) {
    this.buildRelative = fromBuild;
    return this;
  };

  SingleBuilder.prototype.to = function(target) {
    this.target = target;
    return this;
  };

  SingleBuilder.prototype.assign = function(key, value) {
    this.assignments[key] = value;
    return this;
  };

  SingleBuilder.prototype.using = function(rule) {
    this.rule = rule;
    return this;
  };

  return SingleBuilder
})();

var BundleBuilder = (function() {
  function BundleBuilder (pattern) {
    this.pattern = pattern;
    this.buildRelative = false;
    this.assignments = {};
    this.targets = [];
  }

  BundleBuilder.prototype.fromBuild = function(fromBuild) {
    this.buildRelative = fromBuild;
    return this;
  };

  BundleBuilder.prototype.to = function(files) {
    this.targets = this.targets.concat(files);
    return this;
  };

  BundleBuilder.prototype.assign = function(key, value) {
    this.assignments[key] = value;
    return this;
  };

  BundleBuilder.prototype.using = function(rule) {
    this.rule = rule;
  };

  return BundleBuilder;
})();

var setupUtils = function(ninja, srcPath) {
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
};

var edgeAssign = function(edge, assign) {
  var value;
  for (var key in assign) {
    value = assign[key];
    edge.assign(key, value);
  }
};

var compileRules = function(ninja, rules) {
  rules.forEach(function(rule) {
    ninja.rule(rule.name).run(rule.command);
  });
};

var compileSingles = function(ninja, singles, srcPath) {
  singles.forEach(function(single) {
    var filepath  = single.buildRelative ? '.' : srcPath,
        cache = single.buildRelative ? buildCache : srcCache,
        files = glob.sync(single.pattern, {cwd: filepath, cache: cache});

    files.forEach(function(file) {

      // convert OS specific
      file = path.join(file);

      var inputPath = path.join(filepath, file),
          filename = path.basename(file, path.extname(file)),
          outName = single.target.replace('$filename', filename),
          outputPath = path.join(path.dirname(file), outName);

      var edge = ninja.edge(outputPath)
      edge.from(inputPath).using(single.rule);
      edgeAssign(edge, single.assignments);
    });
  });
};

var compileBundles = function(ninja, bundles, srcPath) {
  bundles.forEach(function(bundle) {
    var filepath = bundle.buildRelative ? '.' : srcPath,
        cache = bundle.buildRelative ? buildCache : srcCache,
        files = glob.sync(bundle.pattern, {cwd: filepath, cache: cache});

    if (!bundle.buildRelative) {
      files = _.map(files, function(file) {
        return path.join(srcPath, file);
      });
    }

    if (bundle.targets.length == 0) {
      console.warn('WARN: No targets specified for bundle clause with pattern: ' + bundle.pattern);
      return;
    }

    var edge = ninja.edge(bundle.targets);
    edge.from(files).using(bundle.rule);
    edgeAssign(edge, bundle.assignments);
  });
};

var generate = function(srcPath) {
  srcPath = srcPath || '.';
  srcPath = path.join(srcPath);

  var ninja = ninjaGen(),
      assetConfigPath = path.join(srcPath, 'assets.js'),
      assetConfigStr = fs.readFileSync(assetConfigPath, {encoding:'utf8'});

  setupUtils(ninja, srcPath);

  var rules = [],
      singles = [],
      bundles = [];

  var listBuild = function(list, Type) {
    return function(arg) {
      var obj = new Type(arg);
      list.push(obj);
      return obj;
    };
  };

  // shield config script from global node commands
  var mask = {
    global: undefined,
    process: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    setTimeout: undefined,
    clearTimeout: undefined,
    setInterval: undefined,
    clearInterval: undefined,

    rule: listBuild(rules, RuleBuilder),
    single: listBuild(singles, SingleBuilder),
    bundle: listBuild(bundles, BundleBuilder)
  };

  (new Function('with(this) {' + assetConfigStr + '}')).apply(mask);

  compileRules(ninja, rules);
  compileSingles(ninja, singles, srcPath);
  compileBundles(ninja, bundles, srcPath);

  ninja.save('build.ninja');


  // // Generate rules from assets.json
  // for (var rule in assetConfig.rules) {
  //   ninja.rule(rule).run(assetConfig.rules[rule]);
  // }

  // var outputs = [];
  // for (var pattern in assetConfig.edges) {

  //   // find files that match each pattern
  //   var files = glob.sync(pattern, {cwd: srcPath});

  //   // create build edge for each file found
  //   files.forEach(function(file) {

  //     // use path.join to convert path seperator to OS specific
  //     file = path.join(file);

  //     var inputPath = path.join(srcPath, file),
  //         ext = path.extname(file),
  //         noExt = file.replace(new RegExp(ext + '$'), '');

  //     // Create edge from each output postfix
  //     var outputRules = assetConfig.edges[pattern];
  //     for (var postfix in outputRules) {
  //       var rule = outputRules[postfix];
  //       var outputPath = noExt + postfix;

  //       ninja.edge(outputPath).from(inputPath).using(rule);

  //       // collect outputs
  //       outputs.push(outputPath);
  //     }
  //   });
  // }

  // // Setup edge for building file list
  // var globs = Object.keys(assetConfig.edges).join(' ');
  // ninja.edge('.dirty');
  // ninja.edge('.files').from('.dirty').using('COMPARE_ECHO').assign('glob', globs);

  // // Setup edge for building build.ninja
  // var assetConfigPath = path.join(srcPath, 'assets.json');
  // ninja.edge('build.ninja').from(['.files', assetConfigPath]).using('GENERATE');

  // ninja.edge('clean').using('CLEAN');

  // // Setup defaults
  // ninja.byDefault(outputs.join(' '));

  // ninja.save('build.ninja');
};

// var commandSettings = {
//   action: generate
// };

var argv = process.argv.slice(2);
checkHelp(argv);
// parse(commandSettings, argv);
generate.apply(this, argv);
