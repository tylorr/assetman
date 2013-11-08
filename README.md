# assetman

Boar-to-Git asset manager

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
