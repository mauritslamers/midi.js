/*globals Buffer*/

var readVariableLength = require('./variable_length').readVariableLength;
var util = require('util');

var metaSequenceNumber = function(buffer,offset){
  // ignore first two bytes
  // ignore third byte, because length is always 2
  return {
    type: 'sequenceNumber',
    value: buffer.readUInt16BE(offset + 4),
    length: 5
  };
};

var metaTextEvent = function(buffer,offset){
  //ignore first two bytes (meta flag and type)
  var pos = offset + 2;
  var varlen = readVariableLength(buffer,pos);
  var start = pos + varlen.length;
  var end = start + varlen.value;
  var text = buffer.toString('utf8',start,end);
  return {
    type: 'textevent',
    value: text,
    length: end-offset
  };
};

var metaCopyright = function(buffer,offset){
  //ignore first two bytes (meta flag and type)
  var pos = offset + 2;
  var varlen = readVariableLength(buffer,pos);
  var start = pos + varlen.length;
  var end = start + varlen.value;
  var text = buffer.toString('utf8',start,end);
  return {
    type: 'copyrightevent',
    value: text,
    length: end-offset
  };
};


var metaSequenceName = function(buffer,offset){
  //ignore first two bytes (meta flag and type)
  var pos = offset + 2;
  var varlen = readVariableLength(buffer,pos);
  var start = pos + varlen.length;
  var end = start + varlen.value;
  var text = buffer.toString('utf8',start,end);
  return {
    type: 'sequencename',
    value: text,
    length: end-offset
  };
};

var metaInstrumentName = function(buffer,offset){
  //ignore first two bytes (meta flag and type)
  var pos = offset + 2;
  var varlen = readVariableLength(buffer,pos);
  var start = pos + varlen.length;
  var end = start + varlen.value;
  var text = buffer.toString('utf8',start,end);
  return {
    type: 'instrumentname',
    value: text,
    length: end-offset
  };
};

var metaLyrics = function(buffer,offset){
  var pos = offset + 2;
  var varlen = readVariableLength(buffer,pos);
  var start = pos + varlen.length;
  var end = start + varlen.value;
  var text = buffer.toString('utf8',start,end);
  return {
    type: 'lyrics',
    value: text,
    length: end-offset
  };  
};

var metaMarker = function(buffer,offset){
  var pos = offset + 2;
  var varlen = readVariableLength(buffer,pos);
  var start = pos + varlen.length;
  var end = start + varlen.value;
  var text = buffer.toString('utf8',start,end);
  return {
    type: 'marker',
    value: text,
    length: end-offset
  };  
};

var metaCuePoint = function(buffer,offset){
  var pos = offset + 2;
  var varlen = readVariableLength(buffer,pos);
  var start = pos + varlen.length;
  var end = start + varlen.value;
  var text = buffer.toString('utf8',start,end);
  return {
    type: 'cuepoint',
    value: text,
    length: end-offset
  };  
};

var metaMidiChannelPrefix = function(buffer,offset){
  return {
    type: 'midichannelprefix',
    value: buffer.readUInt8(offset+3),
    length: 4
  };
};

var metaEndOfTrack = function(buffer,offset){
  return {
    type: 'endoftrack',
    length: 3
  };
};

var metaSetTempo = function(buffer,offset){
  // tempo value is coded in 3 bytes, ignore first 3 bytes (meta flag, type, length)
  var data = buffer.readUInt8(offset+3);
  data = (data << 16) + buffer.readUInt16BE(offset+4);
  return {
    type: 'settempo',
    rawvalue: data,
    bpm: (60*1000*1000) / data,
    length: 6
  };
};

var humanReadableFrameRate = function(value){
  switch(value){
    case 0x0: return '24';
    case 0x1: return '25';
    case 0x2: return '30d';
    case 0x3: return '30';
  }
};

var metaSMPTEOffset = function(buffer,offset){
  var pos = offset + 3;
  var rawhour = buffer.readUInt8(pos);
  var min = buffer.readUInt8(pos + 1);
  var sec = buffer.readUInt8(pos + 2);
  var frames = buffer.readUInt8(pos + 3);
  var subframes = buffer.readUInt8(pos + 4);
  var frameRate = rawhour >> 5;
  var hfr = humanReadableFrameRate(frameRate);
  var hour = rawhour & 0x1F; // last 5 bits
  return {
    type: 'smpteoffset',
    rawFrameRate: frameRate,
    frameRate: hfr,
    hours: hour,
    minutes: min,
    seconds: sec,
    frames: frames,
    subframes: subframes,
    length: 8
  };
};

var metaTimeSignature = function(buffer,offset){
  var pos = offset + 3;
  var numerator = buffer.readUInt8(pos);
  var denominator = buffer.readUInt8(pos + 1);
  var metro = buffer.readUInt8(pos + 2);
  var thirtySeconds = buffer.readUInt8(pos + 3);
  var actDenom = Math.pow(2,denominator);
  return {
    type: 'timesignature',
    numerator: numerator,
    rawdenominator: denominator,
    denominator: actDenom, // denominator is put as exponential
    timeSignature: numerator + "/" + actDenom,
    rawMetro: metro, // number of clock signals per click, 24 once per quarter, 48 once per half
    metro: "1/" + (4/(metro/24)), // returns 1/4 for 24, 1/2 for 48,
    thirtySeconds: thirtySeconds, // num of 32nds per 24 midi clock signals
    length: 7 
  };
};

var metaKeySignature = function(buffer,offset){
  var majScales = "Cb Gb Db Ab Eb Bb F C G D A E B F# C#".split(" ");
  var minScales = "Abm Ebm Bbm Fm Cm Gm Dm Am Em Bm F#m C#m G#m D#m A#m".split(" ");
  
  var pos = offset + 3;
  // key negative: number of flats, key positive number of sharps
  var key = buffer.readInt8(pos); // NOT UInt, but Int, as between -7 and 7 
  var scale = buffer.readUInt8(pos+1); // 0 (major) or 1(minor)
  return {
    type: "keysignature",
    key: key,
    scale: scale,
    text: scale? minScales[key+7]: majScales[key+7],
    length: 5
  };
};

var metaSequencerSpecific = function(buffer,offset){
  var varlength = readVariableLength(buffer,offset+2);
  var buf = new Buffer(varlength.value);
  buffer.copy(buf,0,offset+3,(offset+3+varlength.value));
  return {
    type: 'sequencerspecific',
    data: buf,
    length: varlength.value + 2 + varlength.length
  };
};

var metaEventTypes = {
  0x00: metaSequenceNumber,
  0x01: metaTextEvent,
  0x02: metaCopyright,
  0x03: metaSequenceName,
  0x04: metaInstrumentName,
  0x05: metaLyrics,
  0x06: metaMarker,
  0x07: metaCuePoint,
  0x20: metaMidiChannelPrefix,
  0x2F: metaEndOfTrack,
  0x51: metaSetTempo,
  0x54: metaSMPTEOffset,
  0x58: metaTimeSignature,
  0x59: metaKeySignature,
  0x7F: metaSequencerSpecific
};


exports.metaEvent = function(buffer,offset){  
  var pos = 0;
  
  //ret.isMetaEvent = buffer.readUInt8(offset) === 0xFF;
  var ret = {
    isMetaEvent: true,
    offset: offset.toString(16)
  };
  var metaData = metaEventTypes[buffer.readUInt8(offset + 1)](buffer,offset);
  
  for(var i in metaData){
    if(metaData.hasOwnProperty(i)){
      ret[i] = metaData[i];
    }
  }
  return ret;
};