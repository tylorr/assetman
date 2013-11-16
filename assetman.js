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
    minimatch = require('minimatch'),
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

  SingleBuilder.prototype.toExt = function(ext) {
    this.target = '$filename' + ext;
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

var setupUtilRules = function(ninja, srcPath) {
  // Setup rule for building file list file
  var compareEchoPath = path.join(__dirname, 'compare_echo.js'),
      command = 'node ' + compareEchoPath + ' "$glob" $out $path';
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

var compileEdges = function(edgeBuilders, params, compileBuilder) {
  edgeBuilders.forEach(function(edgeBuilder) {
    if (edgeBuilder.buildRelative) {
      params.postBuilders.push({
        builder: edgeBuilder,
        compiler: compileBuilder
      });
      return;
    }

    params.srcPatterns[edgeBuilder.pattern] = true;

    var files = glob.sync(edgeBuilder.pattern, {cwd: params.srcPath, cache: srcCache});

    var outputs = compileBuilder(params.ninja, edgeBuilder, files, params.srcPath);
    params.outputs = params.outputs.concat(outputs);
  });
};

var compilePostBuilders = function(params) {
  var postOutputs = [];
  params.postBuilders.forEach(function(post) {
    var files = _.filter(params.outputs, function(output) {
      return minimatch(output, post.builder.pattern);
    });
    var outputs = post.compiler(params.ninja, post.builder, files, '.');
    postOutputs = postOutputs.concat(outputs);
  });

  params.outputs = params.outputs.concat(postOutputs);
};

var compileSingle = function(ninja, single, files, srcPath) {
  var outputs = [];
  files.forEach(function(file) {

    // convert OS specific
    file = path.join(file);

    var inputPath = path.join(srcPath, file),
        filename = path.basename(file, path.extname(file)),
        outName = single.target.replace('$filename', filename),
        outputPath = path.join(path.dirname(file), outName);

    var edge = ninja.edge(outputPath)
    edge.from(inputPath).using(single.rule);
    edgeAssign(edge, single.assignments);

    outputs.push(outputPath);
  });

  return outputs;
};

var compileBundle = function(ninja, bundle, files, srcPath) {
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

  return bundle.targets;
};

var compileGlobLists = function(ninja, filename, patternMap, path) {
  var patternList = Object.keys(patternMap);

  if (patternList.length > 0) {
    var globs = patternList.join(' ');
    ninja.edge(filename)
      .from('.dirty')
      .assign('glob', globs)
      .assign('path', path)
      .using('COMPARE_ECHO');

    return true;
  }

  return false;
};

var generate = function(srcPath) {
  srcPath = srcPath || '.';
  srcPath = path.join(srcPath);

  var ninja = ninjaGen(),
      assetConfigPath = path.join(srcPath, 'assets.js'),
      assetConfigStr = fs.readFileSync(assetConfigPath, {encoding:'utf8'});

  setupUtilRules(ninja, srcPath);

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

  // evaluate the config script
  (new Function('with(this) {' + assetConfigStr + '}')).apply(mask);

  // stores lists of patterns to check
  var params = {
    ninja: ninja,
    srcPath: srcPath,
    postBuilders: [],
    srcPatterns: {},
    outputs: []
  };

  compileRules(ninja, rules);
  compileEdges(singles, params, compileSingle);
  compileEdges(bundles, params, compileBundle);

  compilePostBuilders(params);

  ninja.edge('.dirty');

  var srcFileList = '.src_files',
      buildFileList = '.build_files';

  compileGlobLists(ninja, srcFileList, params.srcPatterns, srcPath);

  var rebuildDeps = [assetConfigPath, srcFileList];

  ninja.edge('build.ninja')
    .from(rebuildDeps)
    .using('GENERATE');

  ninja.edge('clean').using('CLEAN');

  ninja.byDefault(params.outputs.join(' '));

  ninja.save('build.ninja');
};

var argv = process.argv.slice(2);
checkHelp(argv);
generate.apply(this, argv);
