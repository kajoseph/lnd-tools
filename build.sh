engineVersion=v$(cat package.json | grep '"node":' | sed -r 's/[[:space:]]*["a-z:]*//gi')
exists=$(which node)

if [ -z $exists ]; then
  echo Node is not installed. Node $engineVersion required.
  exit;
fi


nodeVersion=$(node --version)
if [ $(echo $nodeVersion | sed -r 's/v16.*/v16/') != $engineVersion ]; then
  echo Node $engineVersion required.
  exit;
fi

if [ "$1" = "prod" ]; then
  echo Building for production
  npm run clean:prod;
fi

# "pkg ." uses the pkg section of package.json for the build configuration
npm run compile

cp tls.sh ./build

outPath=$(cat package.json | grep '"outputPath":' | sed -r 's/[[:space:]]*["]*//gi' | sed -r 's/(outputPath:)//')
echo
echo Build complete.
echo Output files can be found in ./$outPath