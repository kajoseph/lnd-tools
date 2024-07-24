Usage() {
  echo "Usage: ./release.sh [options]"
  echo
  echo "Options:"
  echo "  --init <os> <arch>    Start a new SHA256SUM file. <os> and <arch> are comma delimited lists"
  echo "  --pack                Compress the binaries into tarballs"
  echo "  --sign                Verify and sign the SHA256SUM file"
  echo "  -h, --help            Output this help message"
  echo
  echo "Example:"
  echo "  ./release.sh"
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
    [ "$PARAM" == "amd64" ] ||
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

TEXT_RED='\033[1;31m' # ref https://stackoverflow.com/a/5947802
TEXT_GREEN='\033[1;32m'
TEXT_YELLOW='\033[1;33m'
TEXT_BLUE='\033[1;34m'
TEXT_NONE='\033[0m'

colorEcho () {
  local COLOR=$1
  if [ "$1" == "red" ]; then
    COLOR=$TEXT_RED
  elif [ "$1" == "green" ]; then
    COLOR=$TEXT_GREEN
  elif [ "$1" == "yellow" ]; then
    COLOR=$TEXT_YELLOW
  elif [ "$1" == "blue" ]; then
    COLOR=$TEXT_BLUE
  else
    COLOR=$TEXT_NONE
  fi
  echo -e "${COLOR}$2${TEXT_NONE}"
}

# colorEcho () {
#   echo -e "$(colorText $1 $2)"
# }

CWD=$(dirname $(readlink -f "$0"))
cd $CWD



VERSION=$(git describe --tags)
INIT=0
OS_ARR={}
ARCH_ARR={}
PACK=0
SIGN=0


for i in `seq 1 $#`; do
  PLUS1=$(( $i + 1 ))
  PLUS2=$(( $i + 2 ))

  if [ "${!i}" == "--init" ]; then
    INIT=1
    OS_INPUT=${!PLUS1}
    OS_ARR=(${OS_INPUT//,/ })
    ARCH_INPUT=${!PLUS2}
    ARCH_ARR=(${ARCH_INPUT//,/ })
  elif [ "${!i}" == "--pack" ]; then
    PACK=1
  elif [ "${!i}" == "--sign" ]; then
    SIGN=1
  elif [ "${!i}" == "--help" ] || [ "${!i}" == "-h" ]; then
    Usage
  fi
done

PACKAGE_VERSION=v$(cat package.json | grep '"version":' | sed -r 's/[[:space:]]*["a-z:]*//gi' | sed -r 's/,//gi' )
echo -e "<< Package.json version is $(colorEcho "red" $PACKAGE_VERSION) >>"
echo

if [ -z $VERSION ]; then
  echo Need to select a tag to release with \`git tag\`
  exit 0
fi

echo Releasing $VERSION. Is that correct? \(y/n\)
read ANS

if [ "$ANS" != "y" ] && [ "$ANS" != "n" ]; then
  echo Invalid response. Exiting.
  exit 0
fi

if [ "$ANS" == "n" ]; then
  echo Please select the version you wish to release with \`git tag\`
  exit 0
fi

git checkout $VERSION &>/dev/null

mkdir -p releases/$VERSION 2>/dev/null

SHA256SUM_FILENAME=$CWD/releases/$VERSION/SHA256SUM

# ================
# --pack
# ================
if [ "$PACK" == "1" ]; then
  colorEcho "blue" "Packing..."
  for os in {linux,macos}; do
    for arch in {x64,arm64}; do
      FILENAME="lnd-tools-$os-$arch-$VERSION"
      if [ -e build/$FILENAME ]; then
        tar -C build --xz -cvf releases/$VERSION/$FILENAME.tar.xz $FILENAME
      fi
    done
  done
fi


# ================
# --init
# ================
if [ "$INIT" == "1" ]; then
  colorEcho "blue" "Initializing release..."
  if [ -e $SHA256SUM_FILENAME ]; then
    echo There is already a SHA256SUM for $VERSION
    exit 0
  fi
  if [[ -z ${OS_ARR[@]} ]]; then
    echo Missing \<os\> param for --init
    exit 0
  fi
  if [[ -z ${ARCH_ARR[@]} ]]; then
    echo Missing \<arch\> param for --init
    exit 0
  fi

  cd build

  for os in ${OS_ARR[@]}; do
    transformOS $os
    for arch in ${ARCH_ARR[@]}; do
      transformArch $arch
      if [ -f lnd-tools-$OS_T-$ARCH_T-$VERSION ]; then
        echo $(shasum -a 256 lnd-tools-$OS_T-$ARCH_T-$VERSION) >> $SHA256SUM_FILENAME
      else
        echo Missing build/lnd-tools-$OS_T-$ARCH_T-$VERSION. Do you need to run build.sh?
      fi
    done
  done
fi
cd $CWD


# ================
# Check and sign SHA256SUM
# ================
colorEcho "blue" "Checking SHA256SUM..."
if [ -e $SHA256SUM_FILENAME ]; then
  echo Found $SHA256SUM_FILENAME
else
  echo No existing SHA256SUM file found. Do you need to --init?
  exit 0
fi

ALL_FILES=
HAS_ERRORS=0
cd build
while IFS= read -r LINE; do
    LINE_ARR=(${LINE// / })
    CHECKSUM=${LINE_ARR[0]}
    FILENAME=${LINE_ARR[1]}

    MY_CHECKSUM_OUTPUT=$(shasum -a 256 $FILENAME)
    MY_CHECKSUM_ARR=(${MY_CHECKSUM_OUTPUT// / })
    MY_CHECKSUM=${MY_CHECKSUM_ARR[0]}

    if [ "$MY_CHECKSUM" != "$CHECKSUM" ]; then
      echo "$FILENAME: $(colorEcho "red" "Mismatched checksums!")"
      echo  Theirs: $CHECKSUM
      echo  Yours : $MY_CHECKSUM
      HAS_ERRORS=1
    else
      echo "$FILENAME: $(colorEcho "green" "OK")"
    fi
    

    ALL_FILES="$ALL_FILES $FILENAME"
done < $SHA256SUM_FILENAME

if [ "$HAS_ERRORS" == "1" ]; then
  exit 0
fi

# one last sanity check
MY_SHA256SUM=$(shasum -a 256 $ALL_FILES)
REAL_SHA256SUM=$(cat $SHA256SUM_FILENAME)
if [ "$(echo $MY_SHA256SUM | tr -d '\n\r')" != "$(echo $REAL_SHA256SUM | tr -d '\n\r')" ]; then
  echo
  colorEcho "yellow" "! Your SHA256SUM mock did not match the existing SHA256SUM"
  echo Yours:
  echo $MY_SHA256SUM
  echo
  echo Theirs:
  echo $REAL_SHA256SUM
  exit 0
fi

cd $CWD

BAD_SIGS=$(gpg --verify $SHA256SUM_FILENAME.asc $SHA256SUM_FILENAME 2>&1 | grep "BAD signature")
if [[ -z $BAD_SIGS ]]; then
  colorEcho "green" "\u2713 All signatures look good."
  if [ "$SIGN" == "1" ]; then
    colorEcho "blue" "Signing..."
    cat $SHA256SUM_FILENAME | gpg -ab >> $SHA256SUM_FILENAME.asc
  fi
else
  echo
  gpg --verify $SHA256SUM_FILENAME.asc $SHA256SUM_FILENAME 2>&1 | grep "BAD signature"

  echo
  echo Not signed.
  exit 0
fi

git switch - &>/dev/null