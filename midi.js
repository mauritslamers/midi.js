// midi file importer

var fs = require('fs');
var util = require('util');

var readVariableLength = require('./lib/variable_length').readVariableLength;
var metaEvent = require('./lib/meta_event').metaEvent;
var sysexEvent = require('./lib/sysex_event').sysexEvent;
var midicontrolEvent = require('./lib/midicontrol_event').midicontrolEvent;

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
  util.log('reading event at offset: ' + offset.toString(16));
  util.log('delta = ' + util.inspect(delta));
  var pos = delta.length;
  byte = buffer.readUInt8(offset + pos);
  util.log('event type byte reads: ' + byte);
  if(byte === 0xFF){ // meta
    util.log('event is meta');
    ret = metaEvent(buffer,offset+pos);
  } else if(byte === 0xF0){ // sysex
    util.log('event is sysex');
    ret = sysexEvent(buffer,offset+pos); 
  } else {
    util.log('event is midicontrol');
    ret = midicontrolEvent(buffer,offset+pos);
  }
  ret['delta'] = delta.value;
  ret.length += delta.length; 
  return ret;
  //return noteEvent(buffer,offset+pos);
};

var readTrack = function(buffer,offset){
  var events = [], chunksize, pos, evt, ret;
  if(!buffer) return;
  var trackh = buffer.toString('utf8',offset,offset + 4);
  util.log('trackh: ' + trackh);
  if(buffer.toString('utf8',offset,offset + 4) !== "MTrk") return;
  chunksize = buffer.readUInt32BE(offset + 4); // number of bytes of trackdata starting next
  util.log('chunksize = ' + chunksize);
  ret = {
    events: events,
    length: chunksize+8
  };
  
  pos = 8;
  while(pos<chunksize+8){
  // for(var i=0;i<8;i+=1){
    evt = readEvent(buffer,offset+pos);
    util.log('event read is: ' + util.inspect(evt));
    pos += evt.length;
    events.push(evt);
    //if(pos >= chunksize) return ret;
  }
  //util.log('events: ' + util.inspect(events));
  return ret;
};


fs.readFile('simon2.mid',function(err,content){
  // content is a Buffer
  var header = readMidiHeader(content);
  if(!header.isMidi) throw('Not a midi file!');
  util.log('header info is: ' + util.inspect(header));
  var tracks = [], track;
  var pos = 14;
  track = readTrack(content,pos);
  track = readTrack(content,pos+track.length);
  // for(var i=0;i<header.numTracks;i+=1){
  //   
  //   track = readTrack(content,pos); // header size is always 14
  //   //util.log('track ' + i + ': '  + util.inspect(track));
  //   pos += track.length;
  //   //util.log('new pos value: ' + pos);
  //   tracks.push(track);
  // }
  //util.log('tracks: ' + util.inspect(tracks));
  
});