keyFile=lnd-tools.key
certFile=lnd-tools.crt
csrFile=lnd-tools.csr

# CAname=MyLocalCA

# echo Creating local CA: $CAname
# openssl genrsa -des3 -out $CAname.key 2048
# openssl req -x509 -new -nodes -key $CAname.key -sha256 -days 1825 -out $CAname.pem
# sudo cp $CAname.pem /usr/local/share/ca-certificates/$CAname.crt
# sudo update-ca-certificates

# echo Local CA created.
# echo
# echo NOTE: if you need to remove the CA, run:
# echo sudo rm /usr/local/share/ca-certificates/$CAname.crt
# echo sudo rm /etc/ssl/certs/dev.local.pem
# echo sudo update-ca-certificates
# echo

if [ $1 == "secp256k1" ]; then
  echo Generating secp256k1 key
  openssl ecparam -genkey -name secp256k1 -out $keyFile;
else
  echo Generating RSA 2048 key
  openssl genrsa -out $keyFile 2048;
fi

echo Generating CSR
openssl req -new -sha256 -key $keyFile -out $csrFile;
echo Generating cert
openssl x509 -req -in $csrFile -signkey $keyFile -out $certFile;

echo Cert created: $certFile

rm $csrFile

# openssl pkcs12 -export -in $certFile -inkey $keyFile \
#       -certfile $HOME/.bp/ssl/MyCA.pem -out lnd-tools.pfx