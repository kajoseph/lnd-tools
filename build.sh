exists=$(which node)

if [ -z $exists ]; then
  echo node is not installed.
  exit;
fi

engineVersion=v$(cat package.json | grep '"node":' | sed -r 's/[[:space:]]*["a-z:]*//gi')
nodeVersion=$(node --version)
if [ $(echo $nodeVersion | sed -r 's/v16.*/v16/') != $engineVersion ]; then
  echo node $engineVersion required.
  exit;
fi

# "pkg ." uses the pkg section of package.json for the build configuration
npm run compile

cp tls.sh ./build

outPath=$(cat package.json | grep '"outputPath":' | sed -r 's/[[:space:]]*["]*//gi' | sed -r 's/(outputPath:)//')
echo build complete.
echo output files can be found in ./$outPath