// midi file importer

var fs = require('fs');
var util = require('util');

var readVariableLength = require('./lib/variable_length').readVariableLength;
var metaEvent = require('./lib/meta_event').metaEvent;

var readMidiHeader = function(buffer){
  var timeDiv, topBit,ret;
  if(!buffer) return;
  
  ret = {
    isMidi: buffer.toString('utf8',0,4) === 'MThd',
    midiFormat: buffer.readUInt16BE(0x08),
    numTracks: buffer.readUInt16BE(0x0a)
  };
  timeDiv = buffer.readUInt16BE(0x0c);
  ret['rawTimeDivision'] = timeDiv;
  topBit = timeDiv & 0x8000;
  if(topBit === 0){ // ticks per beat
    ret['ticksPerBeat'] = timeDiv & 0x7FFF;
  }
  else { // SMPTE
    ret['frameRate'] = timeDiv & 0x7F00;
    ret['ticksPerFrame'] = timeDiv &0x00FF;
  }
  
  return ret;
};

var readEvent = function(buffer,offset){
  // first read byte
  var byte, ret;
  var delta = readVariableLength(buffer,offset);
  util.log('delta = ' + delta.value);
  var pos = delta.length;
  byte = buffer.readUInt8(offset + pos);
  util.log('event type byte reads: ' + byte);
  if(byte === 0xFF){ // meta
    return metaEvent(buffer,offset+pos);
    
  }
  if(byte === 0xF0){ // sysex
    //return sysExEvent(buffer,offset+pos); 
  }
  //return noteEvent(buffer,offset+pos);
  ret = {};
  ret['eventType'] = (byte & 0xFF) >> 4;
  ret['channel'] = byte & 0xF;
  pos += 1;
  ret['param1'] = buffer.readInt8(offset + pos);
  pos += 1;
  ret['param2'] = buffer.readInt8(offset + pos);    
  ret['length'] = pos;
  return ret;
};

var readTrack = function(buffer,offset){
  var events = [], chunksize, pos, evt;
  if(!buffer) return;
  if(buffer.toString('utf8',offset,offset + 4) !== "MTrk") return;
  chunksize = buffer.readUInt32BE(offset + 4); // number of bytes of trackdata starting next
  pos = 8;
  while(pos<chunksize){
    evt = readEvent(buffer,offset+pos);
    pos += evt.length;
    events.push(evt);
  }
  util.log('events: ' + util.inspect(events));
  return {
    events: events,
    length: chunksize+8
  };
};


fs.readFile('simon2.mid',function(err,content){
  // content is a Buffer
  var header = readMidiHeader(content);
  if(!header.isMidi) throw('Not a midi file!');
  util.log('header info is: ' + util.inspect(header));
  var tracks = [], track;
  var pos = 14;
  for(var i=0;i<header.numTracks;i+=1){
    track = readTrack(content,pos); // header size is always 14
    pos += track.length;
    tracks.push(track);
  }
  //util.log('tracks: ' + util.inspect(tracks));
  
});