# assetman

Store large assets such as Photoshop files or uncompressed audio files in a
centralized [Boar](https://code.google.com/p/boar/) repo. Then use `assetman`
to convert the files and place them in a DVCS repo such as Git.

## Why

Distributed version control systems often store entire copies of the repository
in you working directory. Large binary files, such as `.psd` files, cannot be diff'ed
by Git so any time a change is made to these files, another copy of the `.psd` is
added to the repository. Each developer then will end up with multiple copies
of these large asset files.

Boar on the other hand is designed to store large binary files in a centralized
location. The centralized location lets each developer only download the most
recent revision of each file. `assetman` will allow you to store the raw assets
in a boar repo and automatically convert them to smaller assets, such as `.png` files,
for storage in your DVCS repo.

The other use of the boar repo is for "Master Assets". If the compressed assets
in the DVCS repo ever conflict, the assets in the boar repo can act as the master
asset and be re-converted.

## Who

I intend on using this tool for video game development, but it can be useful
for any project using large binary, convertible assets and a DVCS repo.


## Getting Started
<!-- Install the module with: `npm install -g assetman` (Not actually in the npm repo yet). -->
In this example we will be using [Git](http://git-scm.com/) as our DVCS.

Setup your Git and Boar repositorys:

```bash
mkdir my_game
cd my_game

boar --repo=/path/to/boar/repo mksession MyGameAssets
boar --repo=/path/to/boar/repo import raw_assets/ MyGameAssets

git init # you will probably want to add the raw_assets folder to the .gitignore file
```

Add a `assets.json` file to your project:

```json
{
  "boar_repo": "raw_assets",
  "target_dir": "assets",
  "converters" : [
    {
      "pattern": "**/*.psd",
      "tag": "images",
      "commands": [
        "convert \"%i[0]\" \"%n@2x.png\"",
        "convert \"%i[0]\" -resize 50% \"%n@1x.png\"",
      ]
    },
    {
      "pattern": "effects/**/*.wav",
      "tag": "audio",
      "commands": "convert wav file command"
    }
  ]
}
```

Running `assetman all` will convert the matching `.psd` and `.wav` files in the 
`raw_assets` folder and place the resulets in the `assets` folder.

## Commands

* `all` This command will convert all assets in the `boar_repo` folder.
* `recent` Scan the boar log and convert and modified or new files in the last commit.
* `convert` Takes a pattern argument and converts all the files that match using
the appropriate converter from `assets.json`. Take care to use quotation marks when
specifying a pattern. Example: `assetman convert "images/*.*".

Both `all` and `recent` take optional filters that should match the `tag` fields
in the `assets.json` file such as `assetman all images` or `assetman recent audio images`.

## assets.json

```json
{
  "boar_repo": "path to boar working directory",
  "target_dir": "output directory for converted assets",
  "converters" : [
    {
      "pattern": "glob pattern to match relative to boar_repo",
      "tag": "optional tag which identifies which filter this converter belongs to",
      "commands": "a string or array of strings, each one a command line to to execute"
    }
  ]
}
```

The commands string can include two identifiers. `%i` represents the absolute path
to the input assets. `%n` represents the absolute path to the output file, 
excluding the file extension. For example, if `%i` is `/raw_assets/image.psd`
then `%n` would be `/assets/image`.

All globs are matched using the [minimatch](https://github.com/isaacs/minimatch)
library.

## License
Copyright (c) 2013 Tylor Reynolds
Licensed under the MIT license.
