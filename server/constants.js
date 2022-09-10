const CONSTANTS = {};

CONSTANTS.LND = {
  ChannelRejectMessageKey: 'channelRejectMsg',
  ChannelRejectMessage: 'Please contact this node\'s admin to open a channel.',
  ChannelRejectMessageSizeLimit: 500, // this is defined by LND. See https://github.com/alexbosworth/ln-service#subscribetoopenrequests
  ReconnectTimeout: 1000 // 1 second
};

module.exports = CONSTANTS;
