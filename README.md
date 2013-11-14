# assetman

Generates build.ninja files that supports file glob patterns and will recognize
file additions and deletions.

## Getting Started

Install with:
```
npm install -g assetman
```

Create an `assets.json` file in your. 

```json
{
  "rules": {
    "convert2x": "image-convert \"$in\"[0]  \"$out\"",
    "convert1x": "image-convert \"$in\"[0] -resize 50% \"$out\""
  },
  "edges": {
    "**/*.psd": {
      ".png": "convert2x",
      "@2x.png": "convert1x"
    }
  }
}
```

Run `assetman` to generate your build.ninja file, then run `ninja` to build
your files.

```bash
cd assets
assetman ../raw_assets/
ninja
```

Creating or deleting files will trigger ninja to re-run assetman and updating
the files that need to be built.

## `assets.json`

```
{
  "rules": {
    "rule-name": "command line to run. $in is input file, $out is output"
  },
  "edges": {
    "input-glob-pattern": {
      "output-postfix": "rule-name"
    }
  }
}
```

Glob patterns are matched using [glob](https://github.com/isaacs/node-glob) which
relies on [minimatch](https://github.com/isaacs/minimatch).


## License
Copyright (c) 2013 Tylor Reynolds
Licensed under the MIT license.
