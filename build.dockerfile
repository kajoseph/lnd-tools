FROM ubuntu:22.04

RUN apt -y update 
RUN apt -y install git curl

RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs

RUN git --version

VOLUME /lnd-tools/build

WORKDIR /lnd-tools

COPY *.js .
COPY server ./server
COPY client ./client
COPY package.json .
COPY package-lock.json .
COPY build.sh .
COPY tls.sh .

RUN npm i