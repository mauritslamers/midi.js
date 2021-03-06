// midi file importer

var fs = require('fs');
var util = require('util');
var SC = require('sc-runtime');

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
  //util.log('reading event at offset: ' + offset.toString(16));
  //util.log('delta = ' + util.inspect(delta));
  var pos = delta.length;
  byte = buffer.readUInt8(offset + pos);
  //util.log('event type byte reads: ' + byte);
  if(byte === 0xFF){ // meta
    //util.log('event is meta');
    ret = metaEvent(buffer,offset+pos);
  } else if(byte === 0xF0){ // sysex
    //util.log('event is sysex');
    ret = sysexEvent(buffer,offset+pos); 
  } else {
    //util.log('event is midicontrol');
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
  //util.log('trackh: ' + trackh);
  if(buffer.toString('utf8',offset,offset + 4) !== "MTrk") return;
  chunksize = buffer.readUInt32BE(offset + 4); // number of bytes of trackdata starting next
  //util.log('chunksize = ' + chunksize);
  ret = {
    events: events,
    length: chunksize+8
  };
  var time = 0;
  pos = 8;
  while(pos<chunksize+8){
  // for(var i=0;i<8;i+=1){
    evt = readEvent(buffer,offset+pos);
    //util.log('event read is: ' + util.inspect(evt));
    time += evt.delta; // setting the timeOffset to the event
    evt.timeOffset = time; // delta is the time we have to wait to play the event, so it is the offset
    pos += evt.length;
    events.push(evt);
    //if(pos >= chunksize) return ret;
  }
  //util.log('events: ' + util.inspect(events));
  return ret;
};


var readMidiFromBuffer = function(content){
  var header = readMidiHeader(content);
  if(!header.isMidi) return;
  util.log('header info is: ' + util.inspect(header));
  var tracks = [], track;
  var pos = 14;
  for(var i=0;i<header.numTracks;i+=1){ 
    track = readTrack(content,pos); // header size is always 14
    //util.log('track ' + i + ': '  + util.inspect(track));
    pos += track.length;
    //util.log('new pos value: ' + pos);
    tracks.push(track);
  }
  return {
    header: header,
    tracks: tracks
  };
  //util.log('tracks: ' + util.inspect(tracks));
};

var readMidiFile = function(filename,callback){ // callback gets err,array_with_tracks

  fs.readFile(filename,function(err,content){
    // content is a Buffer
    if(err){
      callback(err);
      return;
    } 
    var ret = readMidiFromBuffer(content);
    if(!ret) callback(new Error("Not a midi file"));
    callback(null,ret);
  });
};

var readMidiFileSync = function(filename){
  var content = fs.readFileSync(filename);
  if(content){
    var ret = readMidiFromBuffer(content);
    if(!ret) throw(new Error("Not a midifile"));
    else return ret;
  }
};

exports.readMidiFile = readMidiFile;
exports.readMidiFileSync = readMidiFileSync;

exports.MidiFile = SC.Object.extend({
  filename: null,
  
  _mididata: null,
  
  init: function(){
    arguments.callee.base.apply(this,arguments);
    if(this.filename){
      this._mididata = readMidiFileSync(this.filename);
    }
  },
  
  notes: function(){
    if(!this._mididata) return;
    if(!this._mididata.tracks) return [];

    return this._mididata.tracks.map(function(track){
      var noteEvents = track.events.filter(function(ev){
        if(ev.type === 'noteon' || ev.type === 'noteoff') return true;
      });
      var notes = [];
      var activeNotes = [];
      noteEvents.forEach(function(evt){
        //util.log('evt is: ' + util.inspect(evt));
        if((evt.type === 'noteon') && (evt.velocity > 0)){
          //util.log('evt is noteon with a velocity > 0, so push on activeNotes');
          activeNotes.push(evt);
          return;
        }
        //util.log('contents of activeNotes is: ' + util.inspect(activeNotes));
        // assume we have a note off now, which is either noteon with velocity 0 or a real note off
        var activeEvts = activeNotes.filterProperty('notenumber',evt.notenumber).filterProperty('channel',evt.channel);
        //util.log('after filtering activeEvts, we find: ' + util.inspect(activeEvts));
        if(activeEvts.length > 0){
          // just take first
          var noteon = activeEvts[0];
          activeNotes.removeObject(noteon);
          var newnote = {
            type: 'note',
            start: noteon.timeOffset,
            end: evt.timeOffset,
            duration: evt.timeOffset - noteon.timeOffset,
            channel: evt.channel,
            notenumber: evt.notenumber,
            velocityOn: noteon.velocity,
            velocityOff: evt.velocity // can be either 0 for a noteon-noteoff or something else for a real note off
          };
          //util.log('newly written note is: ' + util.inspect(newnote));
          notes.push(newnote);
        }
      });
      return notes; 
      //util.log('note events: ' + util.inspect(notes));
    });
  }.property(),
  
  absNotes: function(){
    var notenames = ["C","C#/Db","D","D#/Eb","E","F","F#/Gb","G","G#/Ab","A","A#/Bb","B"];
    var notespertrack = this.get('notes');
    return notespertrack.map(function(notes){
      return notes.map(function(n){
        n['notename'] = notenames[(n.notenumber % 12)];
        n['beat'] = this.beatFrom(n.start);
        n.noteLength = this.lengthToNoteLengths(n.duration).join('/');
        
        n.durationInBeats = this.durationInBeats(n.duration);
        return n;
      },this);      
    },this);
  }.property('notes'),
  
  lengthToNoteLengths: function(length){
    var tpb = this._mididata.header.ticksPerBeat;
    var numbeats = Math.floor(length/tpb);
    var rest = length % tpb;
    // for now assume one beat is a quarter (later lookup from time signature)
    var l = 4;
    var t,w = length/tpb;
    var sizes = [];
    for(var i=0;i<7;i+=1){
      t = Math.floor(w/l);
      if(t>0){
        w = w - (l*t);
      }
      sizes.push(t);
      l = l / 2;
    }
    return sizes; 
  },
  
  absNotesInSize: function(){
    var absNotes = this.get('absNotes');


  }.property('absNotes'),
  
  keySignatures: function(){
    // return an array of keys
    var ret = [];
    this._mididata.tracks.forEach(function(t){
      ret = ret.concat(t.events.filterProperty('type','keysignature'));
    });
    // if not, return standard?
    return ret;
  }.property(),
  
  timeSignatures: function(){
    // return an array of events
    var ret = [];
    this._mididata.tracks.forEach(function(t){
      ret = ret.concat(t.events.filterProperty('type','timesignature'));
    });
    // if not found, return standard?
    return ret;
  }.property(),
  
  durationInBeats: function(duration){
    var tpb = this._mididata.header.ticksPerBeat;
    var numbeats = Math.floor(duration/tpb);
    var rest = duration % tpb;
    return [numbeats,rest].join(":");
  },
  
  beatFrom: function(timeOffset){
    // two options: SMTPE or ticksPerBeat
    var h = this._mididata.header;
    if(h.ticksPerBeat){
      var rest = timeOffset % h.ticksPerBeat;
      var bar = (timeOffset - rest) / h.ticksPerBeat;
      return [bar,rest].join(":");
    }
    else throw(new Error("SMPTE bar from not yet implemented"));
  },
  
  tempi: function(){
    var ret = [];
    this._mididata.tracks.forEach(function(t){
      ret = ret.concat(t.events.filterProperty('type','settempo'));
    });
    return ret;
  }.property()
});



