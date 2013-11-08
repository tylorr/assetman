# assetman

Store large assets such as Photoshop files or uncompressed audio files in a
centralized [Boar](https://code.google.com/p/boar/) repo. Then use `assetman`
to convert the files and place them in a DVCS repo such as Git.

## Why

Distributed version control systems often store entire copies of the repository
in you working directory. Large binary files, such as `.psd`s, cannot be diff'ed
by Git so any time a change is made to these files, another copy of the PSD is
added to the repository. Each developer then will end up with multiple copies
of these large asset files.

Boar on the other hand is designed to store large binary files in a centralized
location. The centralized location lets each developer only download the most
recent revision of each file. `assetman` will allow you to store the raw assets
in a boar repo and automatically convert them to smaller assets, such as `.png`s,
for storage in your DVCS repo.

The other use of the boar repo is for "Master Assets". If the compressed assets
in the DVCS repo ever conflict, the assets in the boar repo can act as the master
asset and be re-converted.

## Who

I intend on using this tool for video game development, but it can be useful
for any project using large binary, convertible assets and a DVCS repo.


## Getting Started
<!-- Install the module with: `npm install -g assetman` (Not actually in the npm repo yet). -->

Create an assets.json file in you project to specify directory, converters and
filters. Refer to `example-assets.json` file for help.

## Examples

```
assetman recent            # Convert assets modified in the last Boar commit

assetman all               # Convert all assets in Boar repo

assetman recent images     # Convert recently modified files that match images filter

assetman all images audio  # Convert all files that match audio and images filter

assetman convert "images/sprite*.psd" # Convert all files that match provided filter (Be careful with quotes)
```

## License
Copyright (c) 2013 Tylor Reynolds
Licensed under the MIT license.
