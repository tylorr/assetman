# assetman

Assetman is a Ninja generator that lets you use wildcard/glob patterns. This is
useful when building asset files such as images and audio because there are often
many asset additions and deletions.

Assetman is a build configure tool similar to CMake, but only works with Ninja
by generating `build.ninja` files. Assetman has a focus on building/converting
assets such as images and audio, and adds wildcard/glob pattern features to 
support workflows related to asset production. Assetman is able to produce
`build.ninja` files that re-generate themselves when files are added or removed
from the source directory, something that CMake does not support.

## Getting Started

Install `assetman` with `npm install -g assetman` and install ninja, there are
instructions on the [website](http://martine.github.io/ninja/).

In the source asset folder create a `assets.js` configure script that specifies
which files need to be built and how to build them. Then in the asset build
folder run the following command:

```
assetman ../path/to/asset/source
```

This will generate a `build.ninja` file in the current directory. Running `ninja`
in the command line will then build your files.

## Example

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

### Configure and build

Now in the build directory, in our case the `assets` folder, run the following
command:

```
assetman ../raw_assets
```

This tells `assetman` to run the `assets.js` configure script found in the 
`raw_assets` folder and generate a `build.ninja` file in the current directory.
This file is used by the Ninja build system; running `ninja` in the `assets`
folder will execute the final build step producing `background.png`.

You only have to run the `assetman` command once. Ninja will be able to detect
any changes to the `assets.js` file, and re-generate itself.

### Patterns

Sometimes you may want to use the same rule to convert/build all files that
match a specific wildcard pattern, also known as globbing.

```js
rule('convertHalf').command('convert $in[0] -resize 50% $out');
single('sprites/*.psd').toExt('.png').using('convertHalf');
```

Here we have a rule that converts images to half their original size. The second
line says to look for all the `.psd` files in the `sprites` folder and output 
them with the `.png` extension using the `convertHalf` rule. The resulting
commands would look like this:

```js
convert ../raw_assets/sprites/character.psd[0] -resize 50% sprites/character.png
convert ../raw_assets/sprites/bullet.psd[0] -resize 50% sprites/bullet.png
```

The `build.ninja` file that `assetman` produces is able to recognize file additions
and deletions in the source directory and re-generates itself, so there is no
need to run `asssetman` again.

*Note: To match all of the `.psd` files in the source directory you could use the pattern `**/*.psd`.*

### Bundles

In some situation you may need multiple input files and/or multiple output files.
The common scenario is building atlases from sprite images. For us, this also
poses the issue of building from files that need to be built. First we need to
build our `.psd` files into `.png` files. Then we need to combine the `.png` files
into an atlas.

```js
rule('convert').command('image-convert $in[0] $out');
single('sprites/*.psd').toExt('.png').using('convert');

rule('atlas').command('binpack $in -o $name');
bundle('sprites/*.png')
  .fromBuild(true)
  .to(['atlas.png', 'atlas.csv'])
  .assign('name', 'atlas')
  .using('atlas');
```

This tells `assetman` to build the `.psd` files in the sprites folder into `.png`
files. Then it it says to take all of the `.png` files in the `sprites` folder
in the build directory and produce a `atlas.png` file and a `atlas.csv` file.

The `.fromBuild(true)` command says that the files we are searching for are in
the build directory, not the source directory. The `bundle(...).to(...)` command
does not support the `$filename` variable because it is possible to have more
then one input file.

The `.assign('name', 'atlas')` command tells `assetman` to create a variable
called `name` with the value `atlas`. The `$name` variable is then used by
our rule.

The resulting command would look something like this:

```
binpack sprites/character.png sprites/bullet.png -o atlas
```

## License
Copyright (c) 2013 Tylor Reynolds
Licensed under the MIT license.
