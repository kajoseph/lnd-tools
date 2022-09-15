#!/usr/bin/env bash


CWD=$(dirname $(realpath "$0"))
cd $CWD

ENGINE_VERSION=$(cat package.json | grep '"node":' | sed -r 's/[[:space:]]*["a-z:]*//gi')
EXISTS=$(which node)

if [ -z $EXISTS ]; then
  echo Node is not installed. Node $ENGINE_VERSION required.
  exit;
fi


NODE_VERSION=$(node --version)
if [ $(echo $NODE_VERSION | sed -r 's/v16.*/v16/') != "v$ENGINE_VERSION" ]; then
  echo Node v$ENGINE_VERSION required.
  exit;
fi


Usage () {
  echo "Usage: ./build.sh [options]"
  echo
  echo "If no options are given, it will build for your machine's OS and arch"
  echo
  echo "Options:"
  echo "  --os <value>      Comma delimited list of: macos, linux. No spaces. Required if --arch is given"
  echo "  --arch <value>    Comma delimited list of: x64, arm64. No spaces. Required if --os is given"
  echo "  --all             Build all possible OS-arch combinations"
  echo "  --binary          Only output bytecode binaries. This will produce non-deterministic builds"
  echo "  --checksum        Output the checksums after the builds"
  echo "  -h, --help        Output this help message"
  echo
  echo "Example:"
  echo "  ./build.sh --os macos,linux --arch x64"
  echo

  exit 0
}


transformOS () {
  #make input lower case
  PARAM=$(echo "$1" | tr '[:upper:]' '[:lower:]')

  if [ "$PARAM" == "macos" ]; then
    OS_T="macos"
  elif [ "$PARAM" == "linux" ]; then
    OS_T="linux"
  else
    OS_T=
  fi
}

transformArch () {
  #make input lower case
  PARAM=$(echo "$1" | tr '[:upper:]' '[:lower:]')

  if 
    [ "$PARAM" == "x64" ] ||
    [ "$PARAM" == "x86_64" ] ||
    [ "$PARAM" == "x86" ];
  then
    ARCH_T="x64"
  elif
    [ "$PARAM" == "arm64" ] ||
    [ "$PARAM" == "arm" ] || 
    [ "$PARAM" == "armv8" ];
  then
    ARCH_T="arm64"
  else
    ARCH_T=
  fi
}

# Darwin mbp-0223 21.6.0 Darwin Kernel Version 21.6.0: Mon Aug 22 20:17:10 PDT 2022; root:xnu-8020.140.49~2/RELEASE_X86_64 x86_64
# Darwin mbp-0418 21.6.0 Darwin Kernel Version 21.6.0: Wed Aug 10 14:28:35 PDT 2022; root:xnu-8020.141.5~2/RELEASE_ARM64_T8101 arm64
# Linux bitpay-kenny-xps 5.15.0-47-generic #51-Ubuntu SMP Thu Aug 11 07:51:15 UTC 2022 x86_64 x86_64 x86_64 GNU/Linux

buildForSelf () {
  echo Building for your system
  echo Determining your system specs
  SYSTEM_INFO=$(uname -a)
  SI_ARR=(${SYSTEM_INFO// / })

  if [ "${SI_ARR[0]}" == "Darwin" ]; then
    OS_ARR=(macos)
    ARCH=${SI_ARR[-1]}
  elif [ "${SI_ARR[0]}" == "Linux" ]; then
    OS_ARR=(linux)
    ARCH=${SI_ARR[-2]}
  else
    echo Unknown OS: ${SI_ARR[0]}
    exit 0
  fi

  # make ARCH lowecase
  ARCH=$(echo "$ARCH" | tr '[:upper:]' '[:lower:]')

  if [ "$ARCH" == "x86_64" ]; then
    ARCH_ARR=(x64)
  elif [ "$ARCH" == "arm64" ] || [ "$ARCH" == "aarch64" ]; then
    ARCH_ARR=(arm64)
  else
    echo Unknown architecture: $ARCH
    exit 0
  fi
}

# ===============
# Parse input

BYTECODE=0
CHECKSUM=0

for i in `seq 1 $#`; do
  PLUS1=$(( $i + 1 ))

  if [ "${!i}" == "--os" ]; then
    OS_INPUT=${!PLUS1}
    OS_ARR=(${OS_INPUT//,/ })
  elif [ "${!i}" == "--arch" ]; then
    ARCH_INPUT=${!PLUS1}
    ARCH_ARR=(${ARCH_INPUT//,/ })
  elif [ "${!i}" == "--all" ]; then
    OS_ARR=("linux", "macos")
    ARCH_ARR=("x64", "arm64")
  elif [ "${!i}" == "--binary" ]; then
    BYTECODE=1
  elif [ "${!i}" == "--checksum" ]; then
    CHECKSUM=1
  elif [ "${!i}" == "--help" ] || [ "${!i}" == "-h" ]; then
    Usage
  fi
done

HAS_OS=1
HAS_ARCH=1
if [[ -z ${OS_ARR[@]} ]]; then
  HAS_OS=0
fi
if [[ -z ${ARCH_ARR[@]} ]]; then
  HAS_ARCH=0
fi

# If neither --os nor --arch was given...
if [ HAS_OS == 0 ] && [ HAS_ARCH == 0 ]; then
  # ...default to building for self
  buildForSelf
elif [ HAS_OS == 0 ] && [ HAS_ARCH == 1 ]; then
  # --os was not given but --arch was
  Usage
elif [ HAS_OS == 1 ] && [ HAS_ARCH == 0 ]; then
  # --os was given but --arch was not
  Usage
fi


for os in ${OS_ARR[@]}; do
  transformOS $os
  if [ -z OS_T ]; then
    echo Unknown OS: $os
    exit 1
  fi
done

for arch in ${ARCH_ARR[@]}; do
  transformArch $arch
  if [ -z ARCH_T ]; then
    echo Unknown architecture: $arch
    exit 1
  fi
done


# =========================
# Create .temp dir with dependencies

if [ -e .temp ]; then
  echo Removing existing .temp dir
  rm -rf .temp
fi

echo Making .temp
mkdir .temp
cp package.json .temp
cp package-lock.json .temp
cp *.js .temp
cp -r server .temp
cp -r client .temp

cd .temp

echo Installing dependencies
npm i --omit=dev

cd $CWD

# =========================
# Build the binaries

if [ -e build ]; then
  cd build
else
  mkdir build
  cd build
fi

for os in ${OS_ARR[@]}; do
  transformOS $os
  for arch in ${ARCH_ARR[@]}; do
    transformArch $arch

    TARGET=node$ENGINE_VERSION-$OS_T-$ARCH_T
    OUTPUT=lnd-tools-$OS_T-$ARCH_T
    echo
    echo Building $OUTPUT

    # reminder: this is being run in the $CWD/build folder
    CMD="../node_modules/.bin/pkg ../.temp/lnd-tools.js \
      --config ../package.json \
      --target $TARGET \
      --output $OUTPUT \
      --compress GZip"
      
    if [ $BYTECODE == 0 ]; then
      CMD="$CMD \
        --no-bytecode \
        --public-packages \"*\" \
        --public"
    fi

    $CMD
  done
done

# cd back to cwd
cd $CWD

echo
echo Removing .temp folder
rm -rf .temp

cp ./tls.sh ./build

if [ $CHECKSUM == 1 ]; then
  cd build
  echo
  echo Calculating checksums
  for os in ${OS_ARR[@]}; do
  transformOS $os
    for arch in ${ARCH_ARR[@]}; do
      transformArch $arch
      shasum -a 256 lnd-tools-$OS_T-$ARCH_T
    done
  done
  cd $CWD
fi

echo
echo Build complete.
echo Output files can be found in $CWD/build
