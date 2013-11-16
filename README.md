# assetman

Generates build.ninja files that supports file glob patterns and will recognize
file additions and deletions.

## Getting Started

Install `assetman` with `npm install -g assetman` and install ninja, there are
instruction on the [website](http://martine.github.io/ninja/).

For this example we will be using a file structure that looks like this:

```
project
├──raw_assets
│  ├──sprites
│  │  ├──character.psd
│  │  └──bullet.psd
│  └──background.psd
└──assets
```

The first step is to create an `assets.js` in the source directory. In our case
that is the `raw_assets` folder.

To start off we want to convert only to convert the `background.psd` file in
`raw_assets` to a `background.png` file in the `assets` folder. We will be using
ImageMagick's [convert](http://www.imagemagick.org/script/convert.php) tool to 
build out `.psd` into a `.png`.

To do that add the following to your `assets.js` file:

```js
rule('convert').command('convert $in[0] $out');
single('background.psd').to('background.png').using('convert');
```

The first line says to create a rule named "convert" that runs the command
`convert $in[0] $out`. The second line says to take `background.psd` as an
input file and produce `background.png` as an output file using the rule
`convert`. The words `$in` and `$out` are ninja variables that are replaced
with the input and output files respectively. The `.single()` command only ever
produces one input file and one output file so the resulting command becomes:

```
convert ../raw_assets/background.psd[0] background.png
```

*Note: the '[0]' sequence is used by the convert command, telling it to flatten all of the layers in the psd.*

Since the `.single(pattern)` command only ever has one input and one output, we 
can infer the filename for the output. The filename without an extension is then
stored in the variable `$filename` which can be used in the `.to()` command:

```js
single('background.psd').to('$filename.png').using('convert');
```

There is also a shortcut command, `.toExt()`, that uses the inferred filename 
and lets you specify an extension/suffix:

```js
single('background.psd').toExt('.png').using('convert');
```

### Patterns

Sometimes you may want to use the same rule to convert/build all files that
match a specific wildcard pattern, also known as globbing.

```js
rule('convertHalf').command('convert $in[0] -resize 50% $out');
single('sprites/*.psd').toExt('.png').using('convertHalf');
```

Here we have a rule that converts images to half their original size. The second
line says to look for all the `.psd` files in the `sprites` folder and output 
them wiht the `.png` extension using the `convertHalf` rule. The resulting
commands would look like this:

```
convert ../raw_assets/sprites/character.psd[0] sprites/character.png
convert ../raw_assets/sprites/bullet.psd[0] sprites/bullet.png
```

To match all of the `.psd` files in the source directory you could use the
pattern `**/*.psd`.

### Bundles

Coming soon.


## License
Copyright (c) 2013 Tylor Reynolds
Licensed under the MIT license.
