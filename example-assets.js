rule('convert2').command('image-convert $in[0] $out');
rule('convert').command('image-convert $in[0] -resize 50% $out');
rule('atlas').command('binpack.cmd $in -o $name');
 
var pattern = '**/*.psd';
 
// build foo@2x.png: convert2 ../src/foo.psd
single(pattern).to('$filename@2x.png').using('convert2');
 
// build foo.png: convert ../src/foo.psd
single(pattern).toExt('.png').using('convert');
 
var atlasName = 'atlas';

// build atlas.png atlas.csv: atlas foo.png foo@2x.png
//     name = atlas
bundle('images/*.png')
  .fromBuild(true)
  .to([atlasName + '.png', atlasName + '.csv'])
  .assign('name', atlasName)
  .using('atlas');
