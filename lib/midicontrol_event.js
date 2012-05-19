var util = require('util');

var noteOff = function(buffer,offset){
  var notenumber = buffer.readUInt8(offset+1);
  var velocity = buffer.readUInt8(offset+2);
  return {
    type: 'noteoff',
    notenumber: notenumber,
    velocity: velocity,
    length: 3
  };
};

var noteOn = function(buffer,offset){
  var notenumber = buffer.readUInt8(offset+1);
  var velocity = buffer.readUInt8(offset+2);
  return {
    type: 'noteon',
    notenumber: notenumber,
    velocity: velocity,
    length: 3
  };  
};

var noteAftertouch = function(buffer,offset){
  return {
    type: 'noteaftertouch',
    notenumber: buffer.readUInt8(offset+1),
    value: buffer.readUInt8(offset+2),
    length: 3
  };
};


var controllerTypes = {
   0: 'Bank Select',
   1: 'Modulation',
   2: 'Breath Controller',
   4: 'Foot Controller',
   5: 'Portamento Time',
   6: 'Data Entry (MSB)',
   7: 'Main Volume',
   8: 'Balance',
  10: 'Pan',
  11: 'Expression Controller',
  12: 'Effect Control 1',
  13: 'Effect Control 2',
  16: 'General-Purpose Controller 1',
  17: 'General-Purpose Controller 2',
  18: 'General-Purpose Controller 3',
  19: 'General-Purpose Controller 4',
  32: 'LSB for controller 0',
  33: 'LSB for controller 1',
  34: 'LSB for controller 2',
  35: 'LSB for controller 3',
  36: 'LSB for controller 4',
  37: 'LSB for controller 5',
  38: 'LSB for controller 6',
  39: 'LSB for controller 7',
  40: 'LSB for controller 8',
  41: 'LSB for controller 9',
  42: 'LSB for controller 10',
  43: 'LSB for controller 11',
  44: 'LSB for controller 12',
  45: 'LSB for controller 13',
  46: 'LSB for controller 14',
  47: 'LSB for controller 15',
  48: 'LSB for controller 16',
  49: 'LSB for controller 17',
  50: 'LSB for controller 18',
  51: 'LSB for controller 19',
  52: 'LSB for controller 20',
  53: 'LSB for controller 21',
  54: 'LSB for controller 22',
  55: 'LSB for controller 23',
  56: 'LSB for controller 24',
  57: 'LSB for controller 25',
  58: 'LSB for controller 26',
  59: 'LSB for controller 27',
  60: 'LSB for controller 28',
  61: 'LSB for controller 29',
  62: 'LSB for controller 30',
  63: 'LSB for controller 31',
  64:	'Damper pedal (sustain)',
  65: 'Portamento',
  66: 'Sostenuto',
  67: 'Soft Pedal',
  68: 'Legato Footswitch',
  69: 'Hold 2',
  70: 'Sound Controller 1 (default: Timber Variation)',
  71: 'Sound Controller 2 (default: Timber/Harmonic Content)',
  72: 'Sound Controller 3 (default: Release Time)',
  73: 'Sound Controller 4 (default: Attack Time)',
  74: 'Sound Controller 5',
  75: 'Sound Controller 6',
  76: 'Sound Controller 7',
  77: 'Sound Controller 8',
  78: 'Sound Controller 9',
  79: 'Sound Controller 10',
  80: 'General-Purpose Controller 5',
  81: 'General-Purpose Controller 6',
  82: 'General-Purpose Controller 7',
  83: 'General-Purpose Controller 8',
  84: 'Portamento Control',
  91:	'Effects 1 Depth (formerly External Effects Depth)',
  92:	'Effects 2 Depth (formerly Tremolo Depth)',
  93: 'Effects 3 Depth (formerly Chorus Depth)',
  94: 'Effects 4 Depth (formerly Celeste Detune)',
  95: 'Effects 5 Depth (formerly Phaser Depth)',
  96: 'Data Increment',
  97: 'Data Decrement',
  98: 'Non-Registered Parameter Number (LSB)',
  99: 'Non-Registered Parameter Number (MSB)',
  100: 'Registered Parameter Number (LSB)',
  101: 'Registered Parameter Number (MSB)',
  121: 'Mode Message',
  122: 'Mode Message',
  123: 'Mode Message',
  124: 'Mode Message',
  125: 'Mode Message',
  126: 'Mode Message',
  127: 'Mode Message'
};

var controller = function(buffer,offset){
  var c = buffer.readUInt8(offset+1);
  return {
    type: 'controller',
    controller: c,
    value: buffer.readUInt8(offset+2),
    controllerType: controllerTypes[c],
    length: 3
  };
};

var programchange = function(buffer,offset){
  return {
    type: 'programchange',
    program: buffer.readUInt8(offset+1),
    length: 2
  };
};

var channelaftertouch = function(buffer,offset){
  return {
    type: 'channelaftertouch',
    value: buffer.readUInt8(offset+1),
    length: 2
  };
};

var pitchbend = function(buffer,offset){
  var lsb = buffer.readUInt8(offset+1); // use lowest 7 bit
  var msb = buffer.readUInt8(offset+2); // use lowest 7 bits
  // xxxxxxxx xxxxxxxx 
  // xxxxxxxx xmsb => xmsb xxxxxxxxx (msb << 8)
  // xlsb => lsbx (lsb << 1)
  // xmsb lsbx ( addition )
  // xxms blsb ( addition >> 1)
  var value = ((msb << 8) + (lsb << 1)) >> 1;  
  
  return {
    type: 'pitchbend',
    rawValue: value,
    value: value - 8192, // value centered around 0, between -8192 - 8192 (0-16383)
    length: 3
  };
};

var midicontrolEventTypes = {
  0x08: noteOff,
  0x09: noteOn,
  0x0A: noteAftertouch,
  0x0B: controller,
  0x0C: programchange,
  0x0D: channelaftertouch,
  0x0E: pitchbend
};

var previousType = null;
var previousChannel = null;

exports.midicontrolEvent = function(buffer,offset){  
  var pos = 0;
  var mcData;
  //ret.isMetaEvent = buffer.readUInt8(offset) === 0xFF;
  var ret = {
    isMidicontrolEvent: true
  };
  //util.log('midicontrolevent: reading byte at offset ' + offset.toString(16));
  var b = buffer.readUInt8(offset);
  //util.log('that byte is ' + b.toString(16));
  var type = b >> 4; 
  ret.channel = b & 0x0F;
  ret.offset = offset.toString(16);
  ret.value = b.toString(16);
  //util.log('byte at offset ' + offset.toString(16) + ' is ' + b.toString(16) + ", type is: " + type.toString(16) + ", channel: " + ret.channel);
  var func = midicontrolEventTypes[type];
  if(func){
    mcData = func(buffer,offset);
  }
  else {
    //util.log('running status at ' + offset.toString(16) + ', taking previous status, which is ' + previousType.toString(16));
    ret.channel = previousChannel;
    type = previousType;
    func= midicontrolEventTypes[type];
    mcData = func(buffer,offset-1); // correct for shorter length
    mcData.length -= 1; // when no type given, length is one shorter...
  }
  
  for(var i in mcData){
    if(mcData.hasOwnProperty(i)){
      ret[i] = mcData[i];
    }
  }
  //util.log('midicontrolevent: returning: ' + util.inspect(ret));
  previousType = type;
  previousChannel = ret.channel;
  return ret;
};