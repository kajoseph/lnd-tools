FROM ubuntu:22.04

RUN apt -y update 
RUN apt -y install git curl

RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs

RUN git --version

VOLUME /build

WORKDIR /build
